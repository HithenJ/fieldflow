import { computed, onMounted, ref } from 'vue'
import { db } from '../db'
import type { Job, JobStatus, NewJobPayload } from '../types/job'
import { useSyncQueue } from './useSyncQueue'
import { syncEngine } from '../sync/syncEngine'
import { isFirebaseConfigured } from '../firebase/config'

export function useJobs() {
  const jobs = ref<Job[]>([])
  const isLoading = ref(true)
  const searchQuery = ref('')
  const selectedStatus = ref<string>('All')

  async function refreshJobs() {
    try {
      const storedJobs = await db.getActiveJobs()
      jobs.value = storedJobs.sort((a, b) => {
        // Sort by updatedAt (most recently modified first), fallback to createdAt
        const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0)
        const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0)
        return dateB - dateA
      })
      await refreshQueueStatus()
    } catch (err) {
      console.error('Failed to load jobs from local storage:', err)
    } finally {
      isLoading.value = false
    }
  }

  const {
    pendingCount: pendingSyncCount,
    queueItems,
    isSyncing,
    isOnline,
    lastSyncTime,
    syncError,
    syncNow,
    refreshQueueStatus,
    retryFailedItems,
    discardQueueItem,
    processQueueIfOnline,
  } = useSyncQueue({ onSyncCompleted: refreshJobs })

  onMounted(async () => {
    await db.normalizeLegacyIds()

    if (isFirebaseConfigured && navigator.onLine) {
      // Firebase is configured and we're online — pull from Firestore first
      // Do NOT seed dummy data; Firestore is the source of truth
      console.log('[useJobs] Connecting and syncing with Firestore on mount...')
      await syncEngine.initialLoadFromFirestore()
      await syncEngine.retryFailedItems()
      await syncEngine.processQueue()

      // Only seed if Firestore returned nothing AND local DB is still empty
      const localCount = await db.jobs.count()
      if (localCount === 0) {
        console.log('[useJobs] Firestore and local DB are both empty, seeding defaults...')
        await db.seedIfEmpty()
      }
    } else {
      // Offline or Firebase not configured — seed locally so the app isn't blank
      await db.seedIfEmpty()
    }

    await refreshJobs()
  })

  const totalJobs = computed(() => jobs.value.length)

  const pendingJobs = computed(
    () => jobs.value.filter((job) => job.status === 'Pending').length,
  )

  const inProgressJobs = computed(
    () => jobs.value.filter((job) => job.status === 'In Progress').length,
  )

  const completedJobs = computed(
    () => jobs.value.filter((job) => job.status === 'Completed').length,
  )

  const filteredJobs = computed(() => {
    const query = searchQuery.value.trim().toLowerCase()

    return jobs.value.filter((job) => {
      const matchesSearch =
        !query ||
        job.title.toLowerCase().includes(query) ||
        job.customer.toLowerCase().includes(query) ||
        job.address.toLowerCase().includes(query)

      const matchesStatus =
        selectedStatus.value === 'All' ||
        job.status === selectedStatus.value

      return matchesSearch && matchesStatus
    })
  })

  async function addJob(payload: NewJobPayload) {
    await db.createJob(payload)
    await refreshJobs()
    processQueueIfOnline()
  }

  async function deleteJob(id: number | string) {
    const confirmed = window.confirm('Delete this service job?')
    if (!confirmed) return

    await db.deleteJob(id)
    await refreshJobs()
    processQueueIfOnline()
  }

  async function updateJobStatus(id: number | string, status: JobStatus) {
    await db.updateJobStatus(id, status)
    await refreshJobs()
    processQueueIfOnline()
  }

  async function updateJobDetails(id: number | string, fields: Partial<Job>) {
    await db.updateJob(id, fields)
    await refreshJobs()
    processQueueIfOnline()
  }

  async function syncNowAndRefresh() {
    await syncEngine.retryFailedItems()
    await syncEngine.initialLoadFromFirestore()
    await syncNow()
    await refreshJobs()
  }

  function resetFilters() {
    searchQuery.value = ''
    selectedStatus.value = 'All'
  }

  return {
    jobs,
    isLoading,
    isOnline,
    pendingSyncCount,
    queueItems,
    isSyncing,
    lastSyncTime,
    syncError,
    searchQuery,
    selectedStatus,
    totalJobs,
    pendingJobs,
    inProgressJobs,
    completedJobs,
    filteredJobs,
    refreshJobs,
    addJob,
    deleteJob,
    updateJobStatus,
    updateJobDetails,
    syncNow: syncNowAndRefresh,
    retryFailedItems,
    discardQueueItem,
    resetFilters,
  }
}
