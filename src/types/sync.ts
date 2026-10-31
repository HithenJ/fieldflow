import type { Job } from './job'

export type SyncAction = 'create' | 'update' | 'delete'

export interface SyncQueueItem {
  id?: number
  entityId: string | number
  jobTitle?: string
  action: SyncAction
  payload: Partial<Job>
  clientTimestamp: number
  retryCount: number
  status: 'pending' | 'processing' | 'failed'
  errorMessage?: string
  lastAttemptAt?: number
  nextRetryAt?: number
}
