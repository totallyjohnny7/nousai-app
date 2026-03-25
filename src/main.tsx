import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { StoreProvider } from './store'
import App from './App'
import './index.css'
import { requestPersistentStorage } from './utils/permissions'
import { registerSW } from 'virtual:pwa-register'

// Request persistent storage silently on app load
requestPersistentStorage().catch(() => {})

// Register service worker with auto-update polling.
// Checks for new SW every 5 minutes. Combined with skipWaiting + clientsClaim
// in vite.config.ts, new deploys activate on next page load — no manual cache clear.
registerSW({
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return
    // Poll for SW updates every 5 minutes
    setInterval(() => { registration.update() }, 5 * 60 * 1000)
  },
  onOfflineReady() {
    console.log('[NousAI] App ready for offline use')
  },
})

// MSW: Mock AI responses in dev when NOUSAI_MOCK_AI=true in localStorage
async function enableMocking() {
  if (import.meta.env.PROD || localStorage.getItem('NOUSAI_MOCK_AI') !== 'true') return
  const { worker } = await import('./mocks/browser')
  return worker.start({ onUnhandledRequest: 'bypass' })
}

enableMocking().then(() => {

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <StoreProvider>
        <App />
      </StoreProvider>
    </HashRouter>
  </StrictMode>
)

})
