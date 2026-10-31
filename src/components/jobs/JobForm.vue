<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { JobPriority, NewJobPayload } from '../../types/job'

const emit = defineEmits<{
  (e: 'submit', payload: NewJobPayload): void
  (e: 'close'): void
}>()

const formError = ref('')

const form = ref<NewJobPayload>({
  title: '',
  customer: '',
  address: '',
  priority: 'Medium' as JobPriority,
  scheduledDate: new Date().toLocaleDateString('en-CA'),
  notes: '',
})

function handleSubmit() {
  formError.value = ''

  const title = form.value.title.trim()
  const customer = form.value.customer.trim()
  const address = form.value.address.trim()
  const notes = form.value.notes?.trim() || ''

  if (!title || !customer || !address || !form.value.scheduledDate) {
    formError.value = 'Please complete all required fields.'
    return
  }

  emit('submit', {
    title,
    customer,
    address,
    priority: form.value.priority,
    scheduledDate: form.value.scheduledDate,
    notes,
  })

  // Reset form
  form.value = {
    title: '',
    customer: '',
    address: '',
    priority: 'Medium',
    scheduledDate: new Date().toLocaleDateString('en-CA'),
    notes: '',
  }
}

function handleClose() {
  formError.value = ''
  emit('close')
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    handleClose()
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
  <div class="modal-backdrop" @click.self="handleClose">
    <div class="modal-container">
      <section class="form-panel modal-panel">
        <div class="section-heading">
          <div>
            <h2>Create a new job</h2>
            <p>Add service request details below.</p>
          </div>
          <button
            class="icon-button close-btn"
            type="button"
            aria-label="Close modal"
            @click="handleClose"
          >
            ✕
          </button>
        </div>

        <form class="job-form" @submit.prevent="handleSubmit">
          <label>
            Job title *
            <input
              v-model="form.title"
              required
              placeholder="e.g. AC compressor repair"
              autofocus
            />
          </label>

          <label>
            Customer name *
            <input
              v-model="form.customer"
              required
              placeholder="Enter customer name"
            />
          </label>

          <label class="full-width">
            Service address *
            <input
              v-model="form.address"
              required
              placeholder="Enter service location"
            />
          </label>

          <label>
            Priority
            <select v-model="form.priority">
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </label>

          <label>
            Scheduled date *
            <input v-model="form.scheduledDate" type="date" required />
          </label>

          <label class="full-width">
            Service notes / instructions
            <textarea
              v-model="form.notes"
              rows="3"
              placeholder="Equipment model, access instructions, technician notes..."
            ></textarea>
          </label>

          <p v-if="formError" class="form-error full-width">
            {{ formError }}
          </p>

          <div class="form-actions full-width">
            <button
              class="secondary-button"
              type="button"
              @click="handleClose"
            >
              Cancel
            </button>
            <button class="primary-button" type="submit">
              Save job
            </button>
          </div>
        </form>
      </section>
    </div>
  </div>
</template>
