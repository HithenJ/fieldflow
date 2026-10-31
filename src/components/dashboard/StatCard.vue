<script setup lang="ts">
defineProps<{
  label: string
  count: number
  description: string
  icon: string
  iconColor: 'blue' | 'amber' | 'purple' | 'green'
  active?: boolean
}>()

const emit = defineEmits<{
  (e: 'click'): void
}>()
</script>

<template>
  <article
    class="stat-card"
    :class="{ 'stat-card-active': active }"
    role="button"
    tabindex="0"
    @click="emit('click')"
    @keydown.enter="emit('click')"
  >
    <div class="stat-top">
      <span>{{ label }}</span>
      <span class="stat-icon" :class="iconColor">{{ icon }}</span>
    </div>
    <strong>{{ count }}</strong>
    <p>{{ description }}</p>
  </article>
</template>

<style scoped>
.stat-card {
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(49, 94, 251, 0.08);
}

.stat-card-active {
  border-color: #315efb;
  box-shadow: 0 0 0 2px rgba(49, 94, 251, 0.2);
}
</style>
