import { describe, it, expect } from 'vitest'
import { resolveLastWriteWins, mergeFieldLevel, detectChangedFields } from '../conflictResolver'
import type { Job } from '../../types/job'

describe('Conflict Resolution Engine', () => {
  const baseLocalJob: Job = {
    id: 101,
    title: 'AC repair',
    customer: 'John Doe',
    address: '123 Main St',
    priority: 'High',
    status: 'In Progress',
    scheduledDate: '2026-10-25',
    notes: 'Technician on site',
    updatedAt: '2026-10-25T10:00:00.000Z',
    synced: false,
    isDeleted: false,
  }

  const baseRemoteJob: Job = {
    id: 101,
    title: 'AC repair - Compressor replacement',
    customer: 'John Doe',
    address: '123 Main St, Suite B',
    priority: 'High',
    status: 'Pending',
    scheduledDate: '2026-10-26',
    notes: 'Dispatcher rescheduled for tomorrow',
    updatedAt: '2026-10-25T10:30:00.000Z', // 30 mins later
    synced: true,
    isDeleted: false,
  }

  describe('Last-Write-Wins (LWW) Strategy', () => {
    it('should select remote job when remote timestamp is newer', () => {
      const winner = resolveLastWriteWins(baseLocalJob, baseRemoteJob)
      expect(winner.title).toBe('AC repair - Compressor replacement')
      expect(winner.scheduledDate).toBe('2026-10-26')
      expect(winner.synced).toBe(true)
    })

    it('should select local job when local timestamp is newer', () => {
      const newerLocalJob: Job = {
        ...baseLocalJob,
        updatedAt: '2026-10-25T11:00:00.000Z',
      }
      const winner = resolveLastWriteWins(newerLocalJob, baseRemoteJob)
      expect(winner.status).toBe('In Progress')
      expect(winner.notes).toBe('Technician on site')
      expect(winner.synced).toBe(false)
    })
  })

  describe('Field-Level Merging Strategy', () => {
    it('should preserve technician local field edits (status, notes) while accepting dispatcher remote edits (address, scheduledDate)', () => {
      // Technician modified status and notes locally with newer field timestamps
      const localWithFieldTimestamps: Job = {
        ...baseLocalJob,
        fieldTimestamps: {
          status: '2026-10-25T11:00:00.000Z', // Local status is newer
          notes: '2026-10-25T11:00:00.000Z', // Local notes is newer
        },
      }

      const remoteWithFieldTimestamps: Job = {
        ...baseRemoteJob,
        fieldTimestamps: {
          address: '2026-10-25T10:30:00.000Z',
          scheduledDate: '2026-10-25T10:30:00.000Z',
        },
      }

      const result = mergeFieldLevel(localWithFieldTimestamps, remoteWithFieldTimestamps, ['status', 'notes'])

      expect(result.mergedJob.status).toBe('In Progress') // Kept local status
      expect(result.mergedJob.notes).toBe('Technician on site') // Kept local notes
      expect(result.mergedJob.address).toBe('123 Main St, Suite B') // Accepted remote address
      expect(result.mergedJob.scheduledDate).toBe('2026-10-26') // Accepted remote schedule
      expect(result.winner).toBe('local') // Local wins because fields were kept
    })

    it('should use field-level timestamps for merging when available', () => {
      const localWithFieldTimestamps: Job = {
        ...baseLocalJob,
        fieldTimestamps: {
          status: '2026-10-25T12:00:00.000Z', // Local status is newer despite older doc timestamp
          notes: '2026-10-25T10:00:00.000Z',
        },
      }

      const remoteWithFieldTimestamps: Job = {
        ...baseRemoteJob,
        fieldTimestamps: {
          status: '2026-10-25T11:00:00.000Z',
          address: '2026-10-25T10:30:00.000Z',
        },
      }

      const result = mergeFieldLevel(localWithFieldTimestamps, remoteWithFieldTimestamps, ['status'])
      expect(result.mergedJob.status).toBe('In Progress') // Local wins due to field timestamp
    })

    it('should identify conflicting fields with details', () => {
      const result = mergeFieldLevel(baseLocalJob, baseRemoteJob, ['status', 'notes'])
      expect(result.conflictDetails).toHaveLength(2)
      expect(result.conflictDetails[0].field).toBe('status')
      expect(result.conflictDetails[0].localValue).toBe('In Progress')
      expect(result.conflictDetails[0].remoteValue).toBe('Pending')
    })

    it('should protect id and createdAt fields from being overwritten', () => {
      const localWithId: Job = {
        ...baseLocalJob,
        createdAt: '2026-10-25T09:00:00.000Z',
      }

      const remoteWithDifferentId: Job = {
        ...baseRemoteJob,
        id: 102,
        createdAt: '2026-10-25T08:00:00.000Z',
      }

      const result = mergeFieldLevel(localWithId, remoteWithDifferentId, ['id', 'createdAt'])
      expect(result.mergedJob.id).toBe(102) // Remote id preserved
      expect(result.mergedJob.createdAt).toBe('2026-10-25T08:00:00.000Z') // Remote createdAt preserved
    })

    it('should handle empty locallyChangedFields', () => {
      const result = mergeFieldLevel(baseLocalJob, baseRemoteJob, [])
      expect(result.winner).toBe('remote')
      expect(result.conflictedFields).toHaveLength(0)
    })
  })

  describe('detectChangedFields', () => {
    it('should detect fields with different values', () => {
      const changed = detectChangedFields(baseLocalJob, baseRemoteJob)
      expect(changed).toContain('title')
      expect(changed).toContain('address')
      expect(changed).toContain('status')
      expect(changed).toContain('scheduledDate')
      expect(changed).toContain('notes')
      expect(changed).not.toContain('customer')
      expect(changed).not.toContain('priority')
    })

    it('should ignore metadata fields', () => {
      const localWithMeta: Job = {
        ...baseLocalJob,
        updatedAt: '2026-10-25T10:00:00.000Z',
        synced: false,
        dirtyFields: ['status'],
      }

      const remoteWithMeta: Job = {
        ...baseRemoteJob,
        updatedAt: '2026-10-25T11:00:00.000Z',
        synced: true,
        dirtyFields: [],
      }

      const changed = detectChangedFields(localWithMeta, remoteWithMeta)
      expect(changed).not.toContain('updatedAt')
      expect(changed).not.toContain('synced')
      expect(changed).not.toContain('dirtyFields')
    })

    it('should return empty array for identical jobs', () => {
      const changed = detectChangedFields(baseLocalJob, baseLocalJob)
      expect(changed).toHaveLength(0)
    })
  })
})
