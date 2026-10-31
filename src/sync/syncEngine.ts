import { ref } from 'vue'
import { db } from '../db'
import { getPendingSyncItemsSorted } from '../db/syncQueue'
import type { Job } from '../types/job'
import type { SyncQueueItem } from '../types/sync'
import { isFirebaseConfigured, firebaseConfig } from '../firebase/config'
import { resolveLastWriteWins, mergeFieldLevel, detectChangedFields } from './conflictResolver'

export interface SyncStatus {
  isSyncing: boolean
  isOnline: boolean
  pendingCount: number
  lastSyncTime: string | null
  syncError: string | null
}

export class SyncEngine {
  public isSyncing = ref(false)
  public lastSyncTime = ref<string | null>(null)
  public syncError = ref<string | null>(null)
  public pendingCount = ref(0)
  public queueItems = ref<SyncQueueItem[]>([])
  public isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)

  private syncListeners: (() => void)[] = []
  private firestoreInstance: any = null
  private unsubscribeFirestore: (() => void) | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true))
      window.addEventListener('offline', () => this.handleNetworkChange(false))
    }
  }

  public onSyncCompleted(cb: () => void) {
    this.syncListeners.push(cb)
  }

  private notifySyncCompleted() {
    for (const listener of this.syncListeners) {
      try {
        listener()
      } catch (e) {
        console.error('Error in sync listener:', e)
      }
    }
  }

  private async handleNetworkChange(online: boolean) {
    this.isOnline.value = online
    if (online) {
      console.log('[SyncEngine] Network connection restored. Processing offline queue...')
      await this.processQueue()
      this.startRemoteListener()
    } else {
      this.stopRemoteListener()
    }
  }

  public async updatePendingCount(): Promise<number> {
    const count = await db.getPendingSyncCount()
    this.pendingCount.value = count
    this.queueItems.value = await db.getPendingSyncItems()
    return count
  }

  private calculateBackoffMs(retryCount: number): number {
    const base = 1000
    const delay = Math.min(30000, base * Math.pow(2, retryCount))
    const jitter = Math.random() * 500
    return Math.floor(delay + jitter)
  }

  private async getFirestore() {
    if (this.firestoreInstance) return this.firestoreInstance

    if (isFirebaseConfigured) {
      try {
        const { initializeApp, getApps } = await import('firebase/app')
        const { getFirestore } = await import('firebase/firestore')
        const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
        this.firestoreInstance = getFirestore(app)
        return this.firestoreInstance
      } catch (err) {
        console.warn('[SyncEngine] Firebase SDK dynamic load failed, using local simulation:', err)
      }
    }
    return null
  }

  /**
   * Subscribes to real-time changes from Firestore when online
   */
  public async startRemoteListener(): Promise<void> {
    if (!navigator.onLine || !isFirebaseConfigured || this.unsubscribeFirestore) return

    const firestore = await this.getFirestore()
    if (!firestore) return

    try {
      const { collection, onSnapshot } = await import('firebase/firestore')
      const jobsCol = collection(firestore, 'jobs')

      this.unsubscribeFirestore = onSnapshot(jobsCol, async (snapshot) => {
        const remoteJobs = snapshot.docs.map((d) => d.data() as Job)
        const pendingQueue = await db.syncQueue.where('status').equals('pending').toArray()
        const pendingEntityIds = new Set(pendingQueue.map((q) => String(q.entityId)))

        // Check if this is the initial snapshot (empty local DB)
        const localJobCount = await db.jobs.count()
        const isInitialLoad = localJobCount === 0

        for (const remoteJob of remoteJobs) {
          // Skip deleted jobs
          if (remoteJob.isDeleted) {
            await db.jobs.delete(remoteJob.id)
            continue
          }

          // If we have a pending local change for this job, don't overwrite it here (let push handle conflict)
          if (pendingEntityIds.has(String(remoteJob.id))) continue

          const localJob = await db.jobs.get(remoteJob.id)
          if (!localJob) {
            // New job from remote - add it
            await db.jobs.put({ ...remoteJob, synced: true })
            console.log('[SyncEngine] Pulled new job from remote:', remoteJob.id)
          } else {
            // Existing job - check for updates
            // Use field-level merging if both have dirtyFields or fieldTimestamps
            if (localJob.dirtyFields || remoteJob.fieldTimestamps) {
              const changedFields = detectChangedFields(localJob, remoteJob)
              if (changedFields.length > 0) {
                const mergeResult = mergeFieldLevel(localJob, remoteJob, changedFields)
                console.log('[SyncEngine] Remote listener merge:', mergeResult.winner, mergeResult.conflictedFields)
                await db.jobs.put({ ...mergeResult.mergedJob, synced: true, dirtyFields: [] })
              }
            } else {
              // Fallback to timestamp comparison
              const localTime = localJob.updatedAt ? new Date(localJob.updatedAt).getTime() : 0
              const remoteTime = remoteJob.updatedAt ? new Date(remoteJob.updatedAt).getTime() : 0
              if (remoteTime > localTime) {
                await db.jobs.put({ ...remoteJob, synced: true })
                console.log('[SyncEngine] Remote job is newer, updating local:', remoteJob.id)
              }
            }
          }
        }

        // If this was initial load, refresh the jobs list
        if (isInitialLoad) {
          console.log('[SyncEngine] Initial load complete, pulled', remoteJobs.length, 'jobs from Firestore')
        }

        this.notifySyncCompleted()
      })
    } catch (err) {
      console.warn('[SyncEngine] Remote listener initialization skipped:', err)
    }
  }

  public stopRemoteListener() {
    if (this.unsubscribeFirestore) {
      this.unsubscribeFirestore()
      this.unsubscribeFirestore = null
    }
  }

  /**
   * Performs an initial full load from Firestore
   * Called when local DB is empty to sync all remote jobs
   */
  public async initialLoadFromFirestore(): Promise<void> {
    if (!navigator.onLine || !isFirebaseConfigured) {
      console.log('[SyncEngine] Cannot load from Firestore: offline or not configured')
      return
    }

    const firestore = await this.getFirestore()
    if (!firestore) return

    try {
      const { collection, getDocs } = await import('firebase/firestore')
      const jobsCol = collection(firestore, 'jobs')
      const snapshot = await getDocs(jobsCol)

      const remoteJobs = snapshot.docs.map((d) => d.data() as Job)
      console.log('[SyncEngine] Initial load: fetching', remoteJobs.length, 'jobs from Firestore')

      let addedCount = 0
      for (const remoteJob of remoteJobs) {
        // Skip deleted jobs
        if (remoteJob.isDeleted) continue

        const localJob = await db.jobs.get(remoteJob.id)
        if (!localJob) {
          await db.jobs.put({ ...remoteJob, synced: true })
          addedCount++
        }
      }

      console.log('[SyncEngine] Initial load complete: added', addedCount, 'jobs')
      await this.updatePendingCount()
      this.notifySyncCompleted()
    } catch (err) {
      console.error('[SyncEngine] Initial load from Firestore failed:', err)
    }
  }

  /**
   * Process all pending sync queue items sequentially
   */
  public async processQueue(): Promise<void> {
    if (!navigator.onLine) {
      console.log('[SyncEngine] Device is offline. Queue preserved locally.')
      await this.updatePendingCount()
      return
    }

    if (this.isSyncing.value) {
      return
    }

    this.isSyncing.value = true
    this.syncError.value = null

    try {
      const allPending = await getPendingSyncItemsSorted(db.syncQueue)

      const now = Date.now()
      const eligibleItems = allPending.filter((item) => !item.nextRetryAt || item.nextRetryAt <= now)

      if (eligibleItems.length === 0) {
        this.lastSyncTime.value = new Date().toLocaleTimeString()
        await this.updatePendingCount()
        return
      }

      console.log(`[SyncEngine] Pushing ${eligibleItems.length} queued operations to cloud...`)
      const firestore = await this.getFirestore()

      for (const item of eligibleItems) {
        try {
          if (item.id) {
            await db.syncQueue.update(item.id, { status: 'processing', lastAttemptAt: Date.now() })
          }

          if (firestore) {
            await this.pushToFirestore(firestore, item)
          } else {
            // Simulated cloud push latency for local verification
            await new Promise((resolve) => setTimeout(resolve, 350))
          }

          // Mark job as synced in Dexie
          if (item.action !== 'delete') {
            await db.jobs.update(item.entityId, { synced: true })
          } else {
            await db.jobs.delete(item.entityId)
          }

          // Remove completed mutation from queue
          if (item.id) {
            await db.syncQueue.delete(item.id)
          }
        } catch (itemError: any) {
          console.error(`[SyncEngine] Push failed for ${item.entityId}:`, itemError)
          const newRetryCount = (item.retryCount || 0) + 1
          const backoffDelay = this.calculateBackoffMs(newRetryCount)
          const isExhausted = newRetryCount >= 5

          if (item.id) {
            await db.syncQueue.update(item.id, {
              retryCount: newRetryCount,
              status: isExhausted ? 'failed' : 'pending',
              nextRetryAt: Date.now() + backoffDelay,
              errorMessage: itemError?.message || 'Sync failed',
            })
          }
        }
      }

      this.lastSyncTime.value = new Date().toLocaleTimeString()
      await this.updatePendingCount()
      this.notifySyncCompleted()
    } catch (err: any) {
      console.error('[SyncEngine] Synchronization batch error:', err)
      this.syncError.value = err?.message || 'Synchronization failed.'
    } finally {
      this.isSyncing.value = false
      await this.updatePendingCount()
    }
  }

  private async pushToFirestore(firestore: any, item: SyncQueueItem): Promise<void> {
    const { doc, setDoc, deleteDoc, getDoc } = await import('firebase/firestore')
    const jobRef = doc(firestore, 'jobs', String(item.entityId))

    if (item.action === 'delete') {
      await deleteDoc(jobRef)
      return
    }

    if (item.action === 'update') {
      let remoteSnap: any = null
      try {
        remoteSnap = await getDoc(jobRef)
      } catch (err) {
        console.warn('[SyncEngine] Remote getDoc failed during update, proceeding with merge:', err)
      }

      if (remoteSnap && remoteSnap.exists()) {
        const remoteData = remoteSnap.data() as Job
        const localJob = await db.jobs.get(item.entityId)

        if (localJob) {
          // Use field-level merging if dirtyFields are tracked
          if (localJob.dirtyFields && localJob.dirtyFields.length > 0) {
            const mergeResult = mergeFieldLevel(localJob, remoteData, localJob.dirtyFields)
            console.log('[SyncEngine] Field-level merge result:', mergeResult.winner, mergeResult.conflictedFields)

            // Clear dirtyFields after successful merge
            await db.jobs.update(item.entityId, {
              dirtyFields: [],
              fieldTimestamps: mergeResult.mergedJob.fieldTimestamps,
            })

            await setDoc(jobRef, mergeResult.mergedJob, { merge: true })
          } else {
            // Fallback to last-write-wins
            const resolved = resolveLastWriteWins(localJob, remoteData)
            await setDoc(jobRef, resolved, { merge: true })
          }
          return
        }
      }
    }

    const jobData = await db.jobs.get(item.entityId)
    if (jobData) {
      await setDoc(jobRef, { ...jobData, synced: true }, { merge: true })
    }
  }

  public async retryFailedItems(): Promise<void> {
    await db.retryAllFailed()
    await this.processQueue()
  }

  public async discardItem(id: number): Promise<void> {
    await db.clearQueueItem(id)
    await this.updatePendingCount()
  }
}

export const syncEngine = new SyncEngine()
