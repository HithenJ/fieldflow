export type JobStatus = 'Pending' | 'In Progress' | 'Completed'

export type JobPriority = 'Low' | 'Medium' | 'High'

export interface Job {
  id: number | string
  title: string
  customer: string
  address: string
  priority: JobPriority
  status: JobStatus
  scheduledDate: string
  notes?: string
  createdAt?: string
  updatedAt?: string
  synced?: boolean
  isDeleted?: boolean
  // Field-level tracking for conflict resolution
  dirtyFields?: string[]
  fieldTimestamps?: Record<string, string>
}

export type NewJobPayload = {
  title: string
  customer: string
  address: string
  priority: JobPriority
  scheduledDate: string
  notes?: string
}
