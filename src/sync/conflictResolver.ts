import type { Job } from '../types/job'

export interface ConflictMergeResult {
  winner: 'local' | 'remote' | 'merged'
  mergedJob: Job
  conflictedFields: string[]
  conflictDetails: FieldConflict[]
}

export interface FieldConflict {
  field: string
  localValue: any
  remoteValue: any
  localTimestamp?: string
  remoteTimestamp?: string
}

/**
 * Step 1: Last-Write-Wins (LWW)
 * Compares ISO 8601 timestamps of local vs remote record.
 * If remote is newer, update local; if local is newer, overwrite remote.
 */
export function resolveLastWriteWins(localJob: Job, remoteJob: Job): Job {
  const localTime = localJob.updatedAt ? new Date(localJob.updatedAt).getTime() : 0
  const remoteTime = remoteJob.updatedAt ? new Date(remoteJob.updatedAt).getTime() : 0

  if (remoteTime > localTime) {
    return {
      ...remoteJob,
      synced: true,
    }
  }

  return {
    ...localJob,
    synced: false,
  }
}

/**
 * Step 2: Field-Level Merging
 * Merges non-conflicting field updates between local changes and remote changes.
 * Uses field-level timestamps when available, otherwise falls back to document-level timestamps.
 * Technician may update status and notes while Dispatcher updates scheduledDate and address.
 */
export function mergeFieldLevel(
  localJob: Job,
  remoteJob: Job,
  locallyChangedFields: string[] = [],
): ConflictMergeResult {
  const merged: Job = { ...remoteJob }
  const conflictedFields: string[] = []
  const conflictDetails: FieldConflict[] = []

  // Fields that should never be merged from remote if locally changed
  const protectedFields = ['id', 'createdAt']

  // Merge each field based on timestamps
  for (const field of locallyChangedFields) {
    if (protectedFields.includes(field)) continue

    const localValue = (localJob as any)[field]
    const remoteValue = (remoteJob as any)[field]

    // Get field-level timestamps if available
    const localFieldTime = localJob.fieldTimestamps?.[field]
      ? new Date(localJob.fieldTimestamps[field]).getTime()
      : (localJob.updatedAt ? new Date(localJob.updatedAt).getTime() : 0)

    const remoteFieldTime = remoteJob.fieldTimestamps?.[field]
      ? new Date(remoteJob.fieldTimestamps[field]).getTime()
      : (remoteJob.updatedAt ? new Date(remoteJob.updatedAt).getTime() : 0)

    // If values are the same, no conflict
    if (localValue === remoteValue) {
      continue
    }

    // If both have different values, check timestamps
    if (localFieldTime > remoteFieldTime) {
      // Local change is newer - keep local value
      ;(merged as any)[field] = localValue
      if (merged.fieldTimestamps) {
        merged.fieldTimestamps[field] = localJob.fieldTimestamps?.[field] || localJob.updatedAt!
      }
    } else if (remoteFieldTime > localFieldTime) {
      // Remote change is newer - keep remote value (already in merged)
      conflictedFields.push(field)
      conflictDetails.push({
        field,
        localValue,
        remoteValue,
        localTimestamp: localJob.fieldTimestamps?.[field] || localJob.updatedAt,
        remoteTimestamp: remoteJob.fieldTimestamps?.[field] || remoteJob.updatedAt,
      })
    } else {
      // Same timestamp - value conflict, prefer local (technician's changes)
      ;(merged as any)[field] = localValue
      conflictedFields.push(field)
      conflictDetails.push({
        field,
        localValue,
        remoteValue,
        localTimestamp: localJob.fieldTimestamps?.[field] || localJob.updatedAt,
        remoteTimestamp: remoteJob.fieldTimestamps?.[field] || remoteJob.updatedAt,
      })
    }
  }

  // Merge field-level timestamps from remote for fields not changed locally
  if (remoteJob.fieldTimestamps) {
    merged.fieldTimestamps = { ...remoteJob.fieldTimestamps }
    for (const field of locallyChangedFields) {
      if (localJob.fieldTimestamps?.[field]) {
        merged.fieldTimestamps[field] = localJob.fieldTimestamps[field]
      }
    }
  }

  // Determine winner label
  let winner: 'local' | 'remote' | 'merged' = 'merged'
  if (conflictedFields.length === 0 && locallyChangedFields.length === 0) {
    winner = 'remote'
  } else if (conflictedFields.length === 0) {
    winner = 'local'
  }

  merged.updatedAt = new Date().toISOString()
  merged.synced = false

  return {
    winner,
    mergedJob: merged,
    conflictedFields,
    conflictDetails,
  }
}

/**
 * Detects which fields have different values between local and remote
 */
export function detectChangedFields(localJob: Job, remoteJob: Job): string[] {
  const changedFields: string[] = []
  const ignoreFields = ['id', 'createdAt', 'updatedAt', 'synced', 'isDeleted', 'dirtyFields', 'fieldTimestamps']

  for (const key in localJob) {
    if (ignoreFields.includes(key)) continue
    if ((localJob as any)[key] !== (remoteJob as any)[key]) {
      changedFields.push(key)
    }
  }

  return changedFields
}
