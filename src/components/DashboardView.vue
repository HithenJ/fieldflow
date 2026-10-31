<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useJobs } from '../composables/useJobs'
import { usePwaInstall } from '../composables/usePwaInstall'
import AppSidebar from './layout/AppSidebar.vue'
import AppHeader from './layout/AppHeader.vue'
import AppFooter from './layout/AppFooter.vue'
import ReloadPrompt from './layout/ReloadPrompt.vue'
import WelcomePanel from './dashboard/WelcomePanel.vue'
import StatsGrid from './dashboard/StatsGrid.vue'
import JobForm from './jobs/JobForm.vue'
import JobList from './jobs/JobList.vue'
import SyncQueueModal from './sync/SyncQueueModal.vue'
import type { NewJobPayload } from '../types/job'

const {
  isLoading,
  isOnline,
  pendingSyncCount,
  queueItems,
  isSyncing,
  lastSyncTime,
  syncError,
  totalJobs,
  pendingJobs,
  inProgressJobs,
  completedJobs,
  filteredJobs,
  searchQuery,
  selectedStatus,
  addJob,
  deleteJob,
  updateJobStatus,
  syncNow,
  retryFailedItems,
  discardQueueItem,
  resetFilters,
} = useJobs()

const { isInstallable, installApp } = usePwaInstall()

const showForm = ref(false)
const showQueueModal = ref(false)
const activeNav = ref('dashboard')
const isWelcomeDismissed = ref(false)

onMounted(() => {
  const dismissed = localStorage.getItem('fieldflow_welcome_dismissed')
  if (dismissed === 'true') {
    isWelcomeDismissed.value = true
  }
})

function handleDismissWelcome() {
  isWelcomeDismissed.value = true
  localStorage.setItem('fieldflow_welcome_dismissed', 'true')
}

function handleRestoreWelcome() {
  isWelcomeDismissed.value = false
  localStorage.removeItem('fieldflow_welcome_dismissed')
}

// When selectedStatus changes from the toolbar or stat cards, keep activeNav in sync
watch(selectedStatus, (newStatus) => {
  if (newStatus === 'All') {
    if (activeNav.value !== 'dashboard' && activeNav.value !== 'all') {
      activeNav.value = 'all'
    }
  } else {
    activeNav.value = newStatus
  }
})

function handleSelectNav(nav: string, status: string) {
  activeNav.value = nav
  selectedStatus.value = status
  if (nav === 'dashboard') {
    resetFilters()
  }
}

function handleSelectStatus(status: string) {
  selectedStatus.value = status
}

async function handleCreateJob(payload: NewJobPayload) {
  await addJob(payload)
  showForm.value = false
}
</script>

<template>
  <div class="app-shell">
    <AppSidebar
      :total-jobs="totalJobs"
      :pending-jobs="pendingJobs"
      :in-progress-jobs="inProgressJobs"
      :completed-jobs="completedJobs"
      :selected-status="selectedStatus"
      :active-nav="activeNav"
      :is-online="isOnline"
      :is-installable="isInstallable"
      @select-nav="handleSelectNav"
      @install-app="installApp"
    />

    <main class="main-content">
      <AppHeader
        :active-nav="activeNav"
        :is-online="isOnline"
        :pending-sync-count="pendingSyncCount"
        :is-syncing="isSyncing"
        :last-sync-time="lastSyncTime"
        :is-welcome-dismissed="isWelcomeDismissed"
        @toggle-form="showForm = !showForm"
        @restore-welcome="handleRestoreWelcome"
        @sync-now="syncNow"
        @open-sync-queue="showQueueModal = true"
      />

      <div v-if="syncError" class="sync-error-banner">
        <span>⚠ Sync warning: {{ syncError }}</span>
      </div>

      <!-- Welcome panel is only shown on Dashboard view and when not dismissed -->
      <WelcomePanel
        v-if="activeNav === 'dashboard' && !isWelcomeDismissed"
        :total-jobs="totalJobs"
        :pending-jobs="pendingJobs"
        @dismiss="handleDismissWelcome"
      />

      <StatsGrid
        v-if="activeNav === 'dashboard'"
        :total-jobs="totalJobs"
        :pending-jobs="pendingJobs"
        :in-progress-jobs="inProgressJobs"
        :completed-jobs="completedJobs"
        :active-status="selectedStatus"
        @select-status="handleSelectStatus"
      />

      <!-- Job Form Modal -->
      <JobForm
        v-if="showForm"
        @submit="handleCreateJob"
        @close="showForm = false"
      />

      <!-- Offline Sync Queue Inspector Modal -->
      <SyncQueueModal
        v-if="showQueueModal"
        :queue-items="queueItems"
        :is-syncing="isSyncing"
        :is-online="isOnline"
        @close="showQueueModal = false"
        @sync-now="syncNow"
        @retry-failed="retryFailedItems"
        @discard-item="discardQueueItem"
      />

      <div v-if="isLoading" class="loading-state">
        <p>Loading scheduled jobs...</p>
      </div>

      <JobList
        v-else
        :jobs="filteredJobs"
        v-model:searchQuery="searchQuery"
        v-model:selectedStatus="selectedStatus"
        @create-job="showForm = true"
        @delete-job="deleteJob"
        @change-status="updateJobStatus"
      />

      <AppFooter />
    </main>

    <!-- PWA Service Worker Update / Ready Toast -->
    <ReloadPrompt />
  </div>
</template>
