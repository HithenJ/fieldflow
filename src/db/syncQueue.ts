import type { Table } from 'dexie'
import type { Job } from '../types/job'
import type { SyncQueueItem } from '../types/sync'

type SyncQueueTable = Table<SyncQueueItem, number>

function isActiveQueueItem(item: SyncQueueItem): boolean {
  return item.status === 'pending' || item.status === 'processing'
}

export function mergeUpdatePayload(
  existing: Partial<Job>,
  fields: Partial<Job>,
): Partial<Job> {
  return { ...existing, ...fields }
}

export async function renameEntityInQueue(
  table: SyncQueueTable,
  oldId: number | string,
  newId: string,
): Promise<void> {
  await table.where('entityId').equals(oldId).modify({ entityId: newId })
}

export async function enqueueCreate(
  table: SyncQueueTable,
  job: Job,
): Promise<void> {
  await table.add({
    entityId: job.id,
    jobTitle: job.title,
    action: 'create',
    payload: job,
    clientTimestamp: Date.now(),
    retryCount: 0,
    status: 'pending',
  })
}

export async function enqueueUpdate(
  table: SyncQueueTable,
  entityId: number | string,
  fields: Partial<Job>,
  jobTitle: string,
): Promise<void> {
  const existingQueueItems = await table.where('entityId').equals(entityId).toArray()
  const pendingCreate = existingQueueItems.find(
    (q) => q.action === 'create' && isActiveQueueItem(q),
  )

  if (pendingCreate?.id) {
    await table.update(pendingCreate.id, {
      payload: mergeUpdatePayload(pendingCreate.payload, { ...fields, updatedAt: fields.updatedAt }),
      jobTitle: fields.title || pendingCreate.jobTitle,
      clientTimestamp: Date.now(),
    })
    return
  }

  const pendingUpdate = existingQueueItems.find(
    (q) => q.action === 'update' && q.status === 'pending',
  )

  if (pendingUpdate?.id) {
    await table.update(pendingUpdate.id, {
      payload: mergeUpdatePayload(pendingUpdate.payload, { ...fields, updatedAt: fields.updatedAt }),
      jobTitle: fields.title || pendingUpdate.jobTitle,
      clientTimestamp: Date.now(),
    })
    return
  }

  await table.add({
    entityId,
    jobTitle,
    action: 'update',
    payload: { ...fields, updatedAt: fields.updatedAt },
    clientTimestamp: Date.now(),
    retryCount: 0,
    status: 'pending',
  })
}

/** Returns true when an offline-only create was cancelled (no server delete needed). */
export async function enqueueDelete(
  table: SyncQueueTable,
  entityId: number | string,
  payload: Partial<Job>,
  jobTitle: string,
): Promise<boolean> {
  const existingQueueItems = await table.where('entityId').equals(entityId).toArray()
  const pendingCreate = existingQueueItems.find(
    (q) => q.action === 'create' && isActiveQueueItem(q),
  )

  if (pendingCreate?.id) {
    await table.delete(pendingCreate.id)
    return true
  }

  for (const item of existingQueueItems) {
    if (item.status === 'pending' && item.action === 'update' && item.id) {
      await table.delete(item.id)
    }
  }

  const pendingDelete = existingQueueItems.find(
    (q) => q.action === 'delete' && q.status === 'pending',
  )

  if (pendingDelete?.id) {
    await table.update(pendingDelete.id, {
      payload,
      jobTitle,
      clientTimestamp: Date.now(),
    })
    return false
  }

  await table.add({
    entityId,
    jobTitle,
    action: 'delete',
    payload,
    clientTimestamp: Date.now(),
    retryCount: 0,
    status: 'pending',
  })

  return false
}

export async function getPendingSyncCount(table: SyncQueueTable): Promise<number> {
  return table.where('status').equals('pending').count()
}

export async function getAllSyncQueueItems(table: SyncQueueTable): Promise<SyncQueueItem[]> {
  return table.toArray()
}

export async function getPendingSyncItemsSorted(table: SyncQueueTable): Promise<SyncQueueItem[]> {
  return table.where('status').equals('pending').sortBy('clientTimestamp')
}

export async function retryAllFailedSyncItems(table: SyncQueueTable): Promise<void> {
  await table.where('status').equals('failed').modify({ status: 'pending', retryCount: 0, nextRetryAt: 0 })
  await table.where('status').equals('pending').modify({ nextRetryAt: 0 })
}

export async function clearSyncQueueItem(table: SyncQueueTable, id: number): Promise<void> {
  await table.delete(id)
}
