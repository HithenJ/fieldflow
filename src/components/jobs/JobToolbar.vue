<script setup lang="ts">
const searchQuery = defineModel<string>('searchQuery', { default: '' })
const selectedStatus = defineModel<string>('selectedStatus', { default: 'All' })
</script>

<template>
  <div class="toolbar">
    <label class="search-box">
      <span aria-hidden="true">⌕</span>
      <input
        v-model="searchQuery"
        type="search"
        placeholder="Search jobs, customers or addresses..."
        aria-label="Search jobs"
      />
    </label>

    <select v-model="selectedStatus" aria-label="Filter by status">
      <option>All</option>
      <option>Pending</option>
      <option>In Progress</option>
      <option>Completed</option>
    </select>
  </div>
</template>
