<script setup lang="ts">
import { ref, onMounted } from 'vue'

const offlineReady = ref(false)
const needRefresh = ref(false)
let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | undefined

onMounted(async () => {
  try {
    const { registerSW } = await import('virtual:pwa-register')
    updateServiceWorker = registerSW({
      immediate: true,
      onOfflineReady() {
        offlineReady.value = true
        setTimeout(() => {
          offlineReady.value = false
        }, 4000)
      },
      onNeedRefresh() {
        needRefresh.value = true
      },
    })
  } catch (e) {
    // virtual:pwa-register might not be present in pure test runner
    console.debug('PWA register skipped:', e)
  }
})

function closePrompt() {
  offlineReady.value = false
  needRefresh.value = false
}

async function reload() {
  if (updateServiceWorker) {
    await updateServiceWorker(true)
  }
}
</script>

<template>
  <div v-if="offlineReady || needRefresh" class="pwa-toast" role="alert">
    <div class="pwa-toast-message">
      <span v-if="offlineReady">
        ✓ <strong>FieldFlow</strong> is ready to work offline.
      </span>
      <span v-else>
        ⚡ New version available. Reload to update?
      </span>
    </div>
    <div class="pwa-toast-actions">
      <button v-if="needRefresh" class="pwa-toast-btn primary" type="button" @click="reload">
        Reload
      </button>
      <button class="pwa-toast-btn" type="button" @click="closePrompt">
        Close
      </button>
    </div>
  </div>
</template>
