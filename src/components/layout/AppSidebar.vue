<script setup lang="ts">
defineProps<{
  totalJobs: number
  pendingJobs: number
  inProgressJobs: number
  completedJobs: number
  selectedStatus: string
  activeNav: string
  isOnline?: boolean
  isInstallable?: boolean
}>()

const emit = defineEmits<{
  (e: 'select-nav', nav: string, status: string): void
  (e: 'install-app'): void
}>()
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-top">
      <a
        class="brand"
        href="#"
        aria-label="FieldFlow home"
        @click.prevent="emit('select-nav', 'dashboard', 'All')"
      >
        <span class="brand-icon">F</span>
        <span class="brand-text">FieldFlow</span>
      </a>

      <!-- Install App Button for Mobile -->
      <button
        v-if="isInstallable"
        class="install-app-btn mobile-install"
        type="button"
        title="Install FieldFlow"
        @click="emit('install-app')"
      >
        <span>⬇</span> Install
      </button>
    </div>

    <p class="nav-heading">WORKSPACE</p>

    <nav class="sidebar-nav">
      <button
        class="nav-item"
        :class="{ active: activeNav === 'dashboard' }"
        type="button"
        @click="emit('select-nav', 'dashboard', 'All')"
      >
        <span>▦</span> <span class="nav-label">Dashboard</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: activeNav === 'all' }"
        type="button"
        @click="emit('select-nav', 'all', 'All')"
      >
        <span>☷</span> <span class="nav-label">All jobs</span>
        <span class="nav-count">{{ totalJobs }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: activeNav === 'Pending' }"
        type="button"
        @click="emit('select-nav', 'Pending', 'Pending')"
      >
        <span>◷</span> <span class="nav-label">Pending</span>
        <span class="nav-count">{{ pendingJobs }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: activeNav === 'In Progress' }"
        type="button"
        @click="emit('select-nav', 'In Progress', 'In Progress')"
      >
        <span>↻</span> <span class="nav-label">In progress</span>
        <span class="nav-count">{{ inProgressJobs }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: activeNav === 'Completed' }"
        type="button"
        @click="emit('select-nav', 'Completed', 'Completed')"
      >
        <span>✓</span> <span class="nav-label">Completed</span>
        <span class="nav-count">{{ completedJobs }}</span>
      </button>
    </nav>

    <!-- Desktop Install App Button -->
    <button
      v-if="isInstallable"
      class="install-app-btn desktop-install"
      type="button"
      title="Install FieldFlow as an application"
      @click="emit('install-app')"
    >
      <span>⬇</span> Install App
    </button>

    <div class="sidebar-bottom">
      <span class="connection-dot active"></span>
      <div>
        <strong>Offline Ready</strong>
        <p>Saved to this device</p>
      </div>
    </div>
  </aside>
</template>
