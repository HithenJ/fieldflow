<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  activeNav?: string
  isOnline?: boolean
  pendingSyncCount?: number
  isSyncing?: boolean
  lastSyncTime?: string | null
  isWelcomeDismissed?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-form'): void
  (e: 'restore-welcome'): void
  (e: 'sync-now'): void
  (e: 'open-sync-queue'): void
}>()

const viewTitle = computed(() => {
  switch (props.activeNav) {
    case 'dashboard':
      return 'Dashboard'
    case 'all':
      return 'All Jobs'
    case 'Pending':
      return 'Pending Jobs'
    case 'In Progress':
      return 'In Progress'
    case 'Completed':
      return 'Completed Jobs'
    default:
      return 'Dashboard'
  }
})
</script>

<template>
  <header class="topbar">
    <div class="topbar-left">
      <div class="topbar-title-group">
        <p class="eyebrow">FIELD SERVICE TRACKER</p>
        <div class="topbar-heading-row">
          <h1>{{ viewTitle }}</h1>
          <button
            v-if="isWelcomeDismissed && activeNav === 'dashboard'"
            class="ghost-link"
            type="button"
            title="Show dashboard greeting banner"
            @click="emit('restore-welcome')"
          >
            Show greeting
          </button>
        </div>
      </div>
    </div>

    <div class="topbar-actions">
      <!-- Sync Button & Network Badge -->
      <button
        v-if="pendingSyncCount && pendingSyncCount > 0"
        class="sync-button"
        type="button"
        :disabled="isSyncing || !isOnline"
        :title="isOnline ? 'Push pending changes to cloud' : 'Connect to internet to sync'"
        @click="emit('sync-now')"
      >
        <span class="sync-icon" :class="{ spinning: isSyncing }">↻</span>
        <span>{{ isSyncing ? 'Syncing...' : 'Sync Now' }}</span>
      </button>

      <!-- Network Status indicator -->
      <div class="network-badge" :class="isOnline ? 'online' : 'offline'">
        <span class="status-dot"></span>
        <span class="status-label">{{ isOnline ? 'Online' : 'Offline' }}</span>
        <button
          v-if="pendingSyncCount && pendingSyncCount > 0"
          class="pending-tag clickable"
          type="button"
          title="View offline sync queue"
          @click="emit('open-sync-queue')"
        >
          {{ pendingSyncCount }} queued ↗
        </button>
      </div>

      <button
        class="primary-button"
        type="button"
        @click="emit('toggle-form')"
      >
        <span>＋</span> New job
      </button>
    </div>
  </header>
</template>
