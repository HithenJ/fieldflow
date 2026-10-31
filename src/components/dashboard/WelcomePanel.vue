<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  totalJobs: number
  pendingJobs: number
}>()

const emit = defineEmits<{
  (e: 'dismiss'): void
}>()

const todayFormatted = computed(() => {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date())
})
</script>

<template>
  <section class="welcome-panel">
    <div class="welcome-content">
      <div class="welcome-badge-row">
        <span class="welcome-pill">Workspace Overview</span>
        <span class="welcome-date">{{ todayFormatted }}</span>
      </div>
      <h2>Field Operations Dashboard</h2>
      <p>
        Offline mode ready. You have <strong>{{ pendingJobs }} pending</strong> of {{ totalJobs }} total scheduled jobs.
      </p>
    </div>
    
    <div class="welcome-actions">
      <div class="welcome-symbol" aria-hidden="true">⚡</div>
      <button
        class="welcome-close-btn"
        type="button"
        title="Dismiss panel"
        aria-label="Dismiss welcome panel"
        @click="emit('dismiss')"
      >
        ✕
      </button>
    </div>
  </section>
</template>
