<script setup lang="ts">
const emit = defineEmits<{
  (e: 'create-job'): void
}>()
</script>

<template>
  <div class="empty-state">
    <span>⌕</span>
    <h3>No jobs found</h3>
    <p>Try another search or create a new service job.</p>
    <button class="primary-button" type="button" @click="emit('create-job')">
      Create a job
    </button>
  </div>
</template>
