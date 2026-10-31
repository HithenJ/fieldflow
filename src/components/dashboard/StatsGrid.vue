<script setup lang="ts">
import StatCard from './StatCard.vue'

defineProps<{
  totalJobs: number
  pendingJobs: number
  inProgressJobs: number
  completedJobs: number
  activeStatus?: string
}>()

const emit = defineEmits<{
  (e: 'select-status', status: string): void
}>()
</script>

<template>
  <section class="stats-grid" aria-label="Job statistics">
    <StatCard
      label="All jobs"
      :count="totalJobs"
      description="View all requests"
      icon="📋"
      iconColor="blue"
      :active="activeStatus === 'All'"
      @click="emit('select-status', 'All')"
    />
    <StatCard
      label="Pending"
      :count="pendingJobs"
      description="Waiting to start"
      icon="⏳"
      iconColor="amber"
      :active="activeStatus === 'Pending'"
      @click="emit('select-status', 'Pending')"
    />
    <StatCard
      label="In progress"
      :count="inProgressJobs"
      description="Currently underway"
      icon="🔄"
      iconColor="purple"
      :active="activeStatus === 'In Progress'"
      @click="emit('select-status', 'In Progress')"
    />
    <StatCard
      label="Completed"
      :count="completedJobs"
      description="Finished jobs"
      icon="✅"
      iconColor="green"
      :active="activeStatus === 'Completed'"
      @click="emit('select-status', 'Completed')"
    />
  </section>
</template>
