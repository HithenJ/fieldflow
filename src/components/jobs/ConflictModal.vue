<script setup lang="ts">
import { ref, watch } from 'vue'
import type { FieldConflict } from '../../sync/conflictResolver'

const props = defineProps<{
  jobTitle: string
  conflicts: FieldConflict[]
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'resolve', resolutions: Record<string, 'local' | 'remote'>): void
  (e: 'close'): void
}>()

const resolutions = ref<Record<string, 'local' | 'remote'>>({})

function initializeResolutions() {
  resolutions.value = {}
  for (const conflict of props.conflicts) {
    // Default to local (technician's changes)
    resolutions.value[conflict.field] = 'local'
  }
}

watch(() => props.show, (show) => {
  if (show) {
    initializeResolutions()
  }
})

function handleResolve() {
  emit('resolve', resolutions.value)
}

function formatFieldName(field: string): string {
  return field.replace(/([A-Z])/g, ' $1').trim()
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return 'Empty'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

function formatTime(timestamp?: string): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div v-if="show" class="modal-backdrop">
    <div class="modal-container">
      <div class="modal-panel">
        <div class="modal-header">
          <h2>Resolve Conflict</h2>
          <button class="close-btn" @click="emit('close')">×</button>
        </div>

        <div class="modal-body">
          <p class="conflict-intro">
            Both you and another dispatcher edited this job. Please choose which version to keep for each field.
          </p>

          <div class="job-info">
            <strong>{{ jobTitle }}</strong>
          </div>

          <div class="conflicts-list">
            <div v-for="conflict in conflicts" :key="conflict.field" class="conflict-item">
              <div class="conflict-field">{{ formatFieldName(conflict.field) }}</div>

              <div class="conflict-versions">
                <label class="version-option" :class="{ selected: resolutions[conflict.field] === 'local' }">
                  <input
                    type="radio"
                    :name="conflict.field"
                    :checked="resolutions[conflict.field] === 'local'"
                    @change="resolutions[conflict.field] = 'local'"
                  />
                  <div class="version-content">
                    <span class="version-label">Your version</span>
                    <span class="version-value">{{ formatValue(conflict.localValue) }}</span>
                    <span class="version-time">{{ formatTime(conflict.localTimestamp) }}</span>
                  </div>
                </label>

                <label class="version-option" :class="{ selected: resolutions[conflict.field] === 'remote' }">
                  <input
                    type="radio"
                    :name="conflict.field"
                    :checked="resolutions[conflict.field] === 'remote'"
                    @change="resolutions[conflict.field] = 'remote'"
                  />
                  <div class="version-content">
                    <span class="version-label">Their version</span>
                    <span class="version-value">{{ formatValue(conflict.remoteValue) }}</span>
                    <span class="version-time">{{ formatTime(conflict.remoteTimestamp) }}</span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="secondary-button" @click="emit('close')">Cancel</button>
          <button class="primary-button" @click="handleResolve">Apply Resolutions</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.conflict-intro {
  margin: 0 0 16px;
  color: #59657a;
  font-size: 13px;
  line-height: 1.5;
}

.job-info {
  padding: 12px 16px;
  margin-bottom: 20px;
  background: #f4f6fa;
  border-radius: 8px;
  font-size: 14px;
}

.conflicts-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.conflict-item {
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.conflict-field {
  padding: 10px 14px;
  background: #f8fafc;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  font-weight: 600;
  color: #4e5a70;
  text-transform: capitalize;
}

.conflict-versions {
  display: flex;
  flex-direction: column;
}

.version-option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  cursor: pointer;
  border-bottom: 1px solid #f1f5f9;
  transition: background 0.15s ease;
}

.version-option:last-child {
  border-bottom: none;
}

.version-option:hover {
  background: #f8fafc;
}

.version-option.selected {
  background: #edf1ff;
}

.version-option input {
  margin-top: 2px;
}

.version-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.version-label {
  font-size: 11px;
  font-weight: 600;
  color: #7b8497;
}

.version-value {
  font-size: 13px;
  color: #172033;
  word-break: break-word;
}

.version-time {
  font-size: 11px;
  color: #929aae;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
}
</style>
