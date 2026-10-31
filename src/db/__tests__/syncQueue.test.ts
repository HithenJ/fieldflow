import { describe, expect, it } from 'vitest'
import { mergeUpdatePayload } from '../syncQueue'

describe('syncQueue mutation collapsing', () => {
  it('mergeUpdatePayload combines sequential field updates', () => {
    const first = { status: 'Pending' as const, updatedAt: '2026-01-01T00:00:00.000Z' }
    const second = {
      status: 'In Progress' as const,
      notes: 'Started work',
      updatedAt: '2026-01-01T01:00:00.000Z',
    }

    expect(mergeUpdatePayload(first, second)).toEqual({
      status: 'In Progress',
      notes: 'Started work',
      updatedAt: '2026-01-01T01:00:00.000Z',
    })
  })

  it('mergeUpdatePayload preserves unrelated fields from earlier updates', () => {
    const first = { title: 'AC repair', priority: 'High' as const }
    const second = { customer: 'Ravi Kumar' }

    expect(mergeUpdatePayload(first, second)).toEqual({
      title: 'AC repair',
      priority: 'High',
      customer: 'Ravi Kumar',
    })
  })
})
