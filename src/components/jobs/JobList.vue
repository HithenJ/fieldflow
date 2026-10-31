<script setup lang="ts">
import type { Job, JobStatus } from '../../types/job'
import JobToolbar from './JobToolbar.vue'
import JobCard from './JobCard.vue'
import JobEmptyState from './JobEmptyState.vue'

defineProps<{
  jobs: Job[]
}>()

const emit = defineEmits<{
  (e: 'create-job'): void
  (e: 'delete-job', id: number | string): void
  (e: 'change-status', id: number | string, status: JobStatus): void
}>()

const searchQuery = defineModel<string>('searchQuery', { default: '' })
const selectedStatus = defineModel<string>('selectedStatus', { default: 'All' })
</script>

<template>
  <section class="jobs-section">
    <div class="section-heading">
      <div>
        <h2>Service jobs</h2>
        <p>View and manage scheduled work in local storage.</p>
      </div>
      <span class="result-count">{{ jobs.length }} jobs</span>
    </div>

    <JobToolbar
      v-model:searchQuery="searchQuery"
      v-model:selectedStatus="selectedStatus"
    />

    <div class="job-list">
      <JobCard
        v-for="job in jobs"
        :key="job.id"
        :job="job"
        @change-status="(status) => emit('change-status', job.id, status)"
        @delete="emit('delete-job', job.id)"
      />

      <JobEmptyState
        v-if="jobs.length === 0"
        @create-job="emit('create-job')"
      />
    </div>
  </section>
</template>
