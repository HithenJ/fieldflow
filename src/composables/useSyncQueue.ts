import { onMounted, onUnmounted } from 'vue'
import { syncEngine } from '../sync/syncEngine'

let lifecycleBound = false
const syncCompletedHandlers = new Set<() => void | Promise<void>>()

function notifySyncCompletedHandlers() {
  for (const handler of syncCompletedHandlers) {
    void Promise.resolve(handler()).catch((err) => {
      console.error('[useSyncQueue] Sync completed handler failed:', err)
    })
  }
}

function bindSyncQueueLifecycle() {
  if (lifecycleBound || typeof window === 'undefined') return
  lifecycleBound = true

  syncEngine.onSyncCompleted(() => {
    notifySyncCompletedHandlers()
  })

  void syncEngine.updatePendingCount()

  if (navigator.onLine) {
    void syncEngine.processQueue()
    void syncEngine.startRemoteListener()
  }
}

export function useSyncQueue(options?: { onSyncCompleted?: () => void | Promise<void> }) {
  bindSyncQueueLifecycle()

  const handler = options?.onSyncCompleted
  if (handler) {
    syncCompletedHandlers.add(handler)
  }

  onMounted(async () => {
    await syncEngine.updatePendingCount()
    if (navigator.onLine) {
      void syncEngine.processQueue()
    }
  })

  onUnmounted(() => {
    if (handler) {
      syncCompletedHandlers.delete(handler)
    }
  })

  async function syncNow() {
    await syncEngine.processQueue()
    await syncEngine.updatePendingCount()
  }

  async function refreshQueueStatus() {
    return syncEngine.updatePendingCount()
  }

  return {
    pendingCount: syncEngine.pendingCount,
    queueItems: syncEngine.queueItems,
    isSyncing: syncEngine.isSyncing,
    isOnline: syncEngine.isOnline,
    lastSyncTime: syncEngine.lastSyncTime,
    syncError: syncEngine.syncError,
    syncNow,
    refreshQueueStatus,
    retryFailedItems: () => syncEngine.retryFailedItems(),
    discardQueueItem: (id: number) => syncEngine.discardItem(id),
    processQueueIfOnline: () => {
      if (navigator.onLine) {
        void syncEngine.processQueue()
      }
    },
  }
}
