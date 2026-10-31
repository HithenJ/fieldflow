<script setup lang="ts">
import type { Job, JobStatus } from '../../types/job'
import { formatDate } from '../../utils/date'

const props = defineProps<{
  job: Job
}>()

const emit = defineEmits<{
  (e: 'change-status', status: JobStatus): void
  (e: 'delete'): void
}>()

function onStatusChange(event: Event) {
  const target = event.target as HTMLSelectElement
  emit('change-status', target.value as JobStatus)
}
</script>

<template>
  <article class="job-card">
    <div class="job-marker" aria-hidden="true">
      <span v-if="job.status === 'Completed'">✓</span>
      <span v-else-if="job.status === 'In Progress'">↻</span>
      <span v-else>◷</span>
    </div>

    <div class="job-info">
      <div class="job-title-row">
        <h3>{{ job.title }}</h3>
        <span v-if="job.synced === false" class="sync-pill pending" title="Saved locally, will sync when online">
          ● Queued to sync
        </span>
        <span v-else class="sync-pill synced" title="All changes saved and synced">
          ✓ Synced
        </span>
      </div>
      <p class="customer-name"><strong>{{ job.customer }}</strong></p>
      <p class="job-address">⌖ {{ job.address }}</p>
      <p v-if="job.notes" class="job-notes">{{ job.notes }}</p>
      <p class="job-date">Scheduled: {{ formatDate(job.scheduledDate) }}</p>
    </div>

    <div class="job-meta">
      <span class="priority" :class="job.priority.toLowerCase()">
        {{ job.priority }} priority
      </span>

      <select
        :value="job.status"
        class="status-select"
        :class="job.status.toLowerCase().replace(' ', '-')"
        :aria-label="`Status for ${job.title}`"
        @change="onStatusChange"
      >
        <option value="Pending">Pending</option>
        <option value="In Progress">In Progress</option>
        <option value="Completed">Completed</option>
      </select>

      <button
        class="delete-button"
        type="button"
        :aria-label="`Delete ${job.title}`"
        @click="emit('delete')"
      >
        Delete
      </button>
    </div>
  </article>
</template>
