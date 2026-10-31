import { ref, onMounted } from 'vue'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function usePwaInstall() {
  const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)
  const isInstallable = ref(false)
  const isInstalled = ref(false)

  onMounted(() => {
    // Check if running in standalone mode (already installed)
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    ) {
      isInstalled.value = true
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      deferredPrompt.value = e as BeforeInstallPromptEvent
      isInstallable.value = true
    })

    window.addEventListener('appinstalled', () => {
      isInstalled.value = true
      isInstallable.value = false
      deferredPrompt.value = null
      console.log('[PWA] FieldFlow was installed successfully.')
    })
  })

  async function installApp(): Promise<boolean> {
    if (!deferredPrompt.value) return false

    deferredPrompt.value.prompt()
    const choice = await deferredPrompt.value.userChoice

    if (choice.outcome === 'accepted') {
      console.log('[PWA] User accepted installation')
      isInstallable.value = false
      deferredPrompt.value = null
      return true
    } else {
      console.log('[PWA] User dismissed installation')
      return false
    }
  }

  return {
    isInstallable,
    isInstalled,
    installApp,
  }
}
