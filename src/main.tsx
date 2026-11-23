import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { SyncGate } from './components/SyncGate.tsx'
import { applyTheme } from './lib/theme.ts'
import { loadSettings } from './services/storage/settingsRepository.ts'

// Ask the browser not to evict localStorage (API key, saved courses) under storage pressure.
void navigator.storage?.persist?.()

// Before the first paint, so the saved color theme never flashes the default one.
applyTheme(loadSettings().theme)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <SyncGate>
        <App />
      </SyncGate>
    </ErrorBoundary>
  </StrictMode>,
)
