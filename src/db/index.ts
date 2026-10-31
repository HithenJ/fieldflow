import Dexie, { type Table } from 'dexie'
import type { Job, NewJobPayload, JobStatus } from '../types/job'
import type { SyncQueueItem } from '../types/sync'
import {
  clearSyncQueueItem,
  enqueueCreate,
  enqueueDelete,
  enqueueUpdate,
  getAllSyncQueueItems,
  getPendingSyncCount,
  renameEntityInQueue,
  retryAllFailedSyncItems,
} from './syncQueue'

export const defaultSeedJobs: Job[] = [
  {
    id: 'JOB-001',
    title: 'Air conditioner repair',
    customer: 'Ravi Kumar',
    address: 'Madhapur, Hyderabad',
    priority: 'High',
    status: 'Pending',
    scheduledDate: '2026-10-23',
    notes: 'Check cooling coil and refrigerant pressure.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    synced: true,
    isDeleted: false,
  },
  {
    id: 'JOB-002',
    title: 'Electrical inspection',
    customer: 'Priya Sharma',
    address: 'Kondapur, Hyderabad',
    priority: 'Medium',
    status: 'In Progress',
    scheduledDate: '2026-10-23',
    notes: 'Main distribution board circuit breaker tripping periodically.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    synced: true,
    isDeleted: false,
  },
  {
    id: 'JOB-003',
    title: 'Water leakage repair',
    customer: 'Arjun Reddy',
    address: 'Gachibowli, Hyderabad',
    priority: 'High',
    status: 'Completed',
    scheduledDate: '2026-10-22',
    notes: 'Replaced master shutoff valve seal under kitchen sink.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    synced: true,
    isDeleted: false,
  },
  {
    id: 'JOB-004',
    title: 'Washing machine service',
    customer: 'Sneha Rao',
    address: 'Kukatpally, Hyderabad',
    priority: 'Low',
    status: 'Pending',
    scheduledDate: '2026-10-24',
    notes: 'Annual maintenance and drain filter cleaning.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    synced: true,
    isDeleted: false,
  },
]

export class FieldFlowDatabase extends Dexie {
  jobs!: Table<Job, number | string>
  syncQueue!: Table<SyncQueueItem, number>

  constructor() {
    super('fieldflow_db')
    this.version(1).stores({
      jobs: 'id, customer, status, priority, scheduledDate, updatedAt, synced, isDeleted',
      syncQueue: '++id, entityId, action, status, clientTimestamp',
    })
  }

  async seedIfEmpty(): Promise<void> {
    const count = await this.jobs.count()
    if (count === 0) {
      await this.jobs.bulkAdd(defaultSeedJobs)
    }
  }

  async normalizeLegacyIds(): Promise<void> {
    const allJobs = await this.jobs.toArray()
    const hasLegacy = allJobs.some((j) => typeof j.id === 'number')
    if (!hasLegacy) return

    allJobs.sort((a, b) => {
      const idA = typeof a.id === 'number' ? a.id : 9999999999999
      const idB = typeof b.id === 'number' ? b.id : 9999999999999
      return idA - idB
    })

    await this.transaction('rw', this.jobs, this.syncQueue, async () => {
      let index = 1
      for (const job of allJobs) {
        if (typeof job.id === 'number') {
          const oldId = job.id
          const newId = `JOB-${String(index).padStart(3, '0')}`

          await this.jobs.delete(oldId)
          job.id = newId
          await this.jobs.put(job)

          await renameEntityInQueue(this.syncQueue, oldId, newId)
        } else if (typeof job.id === 'string' && job.id.startsWith('JOB-')) {
          const num = parseInt(job.id.replace('JOB-', ''), 10)
          if (!isNaN(num) && num >= index) {
            index = num
          }
        }
        index++
      }
    })
  }

  async getActiveJobs(): Promise<Job[]> {
    return this.jobs
      .filter((job) => !job.isDeleted)
      .toArray()
  }

  async generateNextTicketId(): Promise<string> {
    const allJobs = await this.jobs.toArray()
    let maxNumber = 0

    for (const job of allJobs) {
      if (typeof job.id === 'string' && job.id.startsWith('JOB-')) {
        const numPart = parseInt(job.id.replace('JOB-', ''), 10)
        if (!isNaN(numPart) && numPart > maxNumber) {
          maxNumber = numPart
        }
      } else if (typeof job.id === 'number') {
        if (job.id < 100000 && job.id > maxNumber) {
          maxNumber = job.id
        }
      }
    }

    const nextNumber = maxNumber + 1
    return `JOB-${String(nextNumber).padStart(3, '0')}`
  }

  async createJob(payload: NewJobPayload): Promise<Job> {
    const now = new Date().toISOString()
    const ticketId = await this.generateNextTicketId()

    const newJob: Job = {
      id: ticketId,
      title: payload.title,
      customer: payload.customer,
      address: payload.address,
      priority: payload.priority,
      status: 'Pending',
      scheduledDate: payload.scheduledDate,
      notes: payload.notes || '',
      createdAt: now,
      updatedAt: now,
      synced: false,
      isDeleted: false,
    }

    await this.transaction('rw', this.jobs, this.syncQueue, async () => {
      await this.jobs.put(newJob)
      await enqueueCreate(this.syncQueue, newJob)
    })

    return newJob
  }

  async updateJobStatus(id: number | string, status: JobStatus): Promise<void> {
    const now = new Date().toISOString()
    await this.transaction('rw', this.jobs, this.syncQueue, async () => {
      const existingJob = await this.jobs.get(id)
      const currentDirtyFields = existingJob?.dirtyFields || []
      const currentFieldTimestamps = existingJob?.fieldTimestamps || {}

      // Track field-level changes
      const updatedDirtyFields = [...new Set([...currentDirtyFields, 'status'])]
      const updatedFieldTimestamps = {
        ...currentFieldTimestamps,
        status: now,
      }

      await this.jobs.update(id, {
        status,
        updatedAt: now,
        synced: false,
        dirtyFields: updatedDirtyFields,
        fieldTimestamps: updatedFieldTimestamps,
      })

      await enqueueUpdate(
        this.syncQueue,
        id,
        { status, updatedAt: now, dirtyFields: updatedDirtyFields, fieldTimestamps: updatedFieldTimestamps },
        existingJob?.title || 'Job status update',
      )
    })
  }

  async updateJob(id: number | string, fields: Partial<Job>): Promise<void> {
    const now = new Date().toISOString()
    await this.transaction('rw', this.jobs, this.syncQueue, async () => {
      const existingJob = await this.jobs.get(id)
      const currentDirtyFields = existingJob?.dirtyFields || []
      const currentFieldTimestamps = existingJob?.fieldTimestamps || {}

      // Track which fields are being changed
      const changedFieldNames = Object.keys(fields).filter(k => k !== 'updatedAt' && k !== 'synced')
      const updatedDirtyFields = [...new Set([...currentDirtyFields, ...changedFieldNames])]

      // Update field-level timestamps
      const updatedFieldTimestamps = { ...currentFieldTimestamps }
      for (const field of changedFieldNames) {
        updatedFieldTimestamps[field] = now
      }

      await this.jobs.update(id, {
        ...fields,
        updatedAt: now,
        synced: false,
        dirtyFields: updatedDirtyFields,
        fieldTimestamps: updatedFieldTimestamps,
      })

      await enqueueUpdate(
        this.syncQueue,
        id,
        { ...fields, updatedAt: now, dirtyFields: updatedDirtyFields, fieldTimestamps: updatedFieldTimestamps },
        fields.title || existingJob?.title || 'Job update',
      )
    })
  }

  async deleteJob(id: number | string): Promise<void> {
    const now = new Date().toISOString()
    await this.transaction('rw', this.jobs, this.syncQueue, async () => {
      const existingJob = await this.jobs.get(id)
      const cancelledOfflineCreate = await enqueueDelete(
        this.syncQueue,
        id,
        { id, isDeleted: true, updatedAt: now },
        existingJob?.title || 'Deleted job',
      )

      if (cancelledOfflineCreate) {
        await this.jobs.delete(id)
      } else {
        await this.jobs.update(id, {
          isDeleted: true,
          updatedAt: now,
          synced: false,
        })
      }
    })
  }

  async getPendingSyncCount(): Promise<number> {
    return getPendingSyncCount(this.syncQueue)
  }

  async getPendingSyncItems(): Promise<SyncQueueItem[]> {
    return getAllSyncQueueItems(this.syncQueue)
  }

  async retryAllFailed(): Promise<void> {
    await retryAllFailedSyncItems(this.syncQueue)
  }

  async clearQueueItem(id: number): Promise<void> {
    await clearSyncQueueItem(this.syncQueue, id)
  }
}

export const db = new FieldFlowDatabase()
