<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import type { SyncQueueItem } from '../../types/sync'

defineProps<{
  queueItems: SyncQueueItem[]
  isSyncing: boolean
  isOnline: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'sync-now'): void
  (e: 'retry-failed'): void
  (e: 'discard-item', id: number): void
}>()

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-container">
      <section class="form-panel modal-panel sync-modal">
        <div class="section-heading">
          <div>
            <h2>Offline Sync Queue</h2>
            <p>Pending operations stored locally on this device.</p>
          </div>
          <button
            class="icon-button close-btn"
            type="button"
            aria-label="Close modal"
            @click="emit('close')"
          >
            ✕
          </button>
        </div>

        <div v-if="queueItems.length === 0" class="empty-queue">
          <span>✓</span>
          <p><strong>All changes are in sync!</strong></p>
          <p class="muted">No pending offline operations.</p>
        </div>

        <div v-else class="queue-list">
          <div
            v-for="item in queueItems"
            :key="item.id"
            class="queue-item"
            :class="item.status"
          >
            <div class="queue-action-pill" :class="item.action">
              {{ item.action.toUpperCase() }}
            </div>

            <div class="queue-details">
              <strong>{{ item.jobTitle || 'Service Job' }}</strong>
              <div class="queue-meta">
                <span>Queued at {{ formatTime(item.clientTimestamp) }}</span>
                <span v-if="item.retryCount > 0" class="retry-badge">
                  Retry #{{ item.retryCount }}
                </span>
                <span v-if="item.errorMessage" class="error-msg">
                  ⚠ {{ item.errorMessage }}
                </span>
              </div>
            </div>

            <button
              v-if="item.status === 'failed' && item.id"
              class="discard-btn"
              type="button"
              title="Discard failed change"
              @click="emit('discard-item', item.id)"
            >
              ✕
            </button>
          </div>
        </div>

        <div class="sync-modal-footer">
          <span class="queue-status-text">
            {{ isOnline ? 'Network connected' : 'Offline mode active' }}
          </span>

          <div class="footer-actions">
            <button
              class="secondary-button"
              type="button"
              @click="emit('close')"
            >
              Close
            </button>
            <button
              v-if="queueItems.length > 0"
              class="primary-button"
              type="button"
              :disabled="isSyncing || !isOnline"
              @click="emit('sync-now')"
            >
              <span class="sync-icon" :class="{ spinning: isSyncing }">↻</span>
              <span>{{ isSyncing ? 'Syncing...' : 'Sync Now' }}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
