import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { loadAppearanceSetting } from './lib/store'
import { resolveTheme } from './lib/theme'

async function bootstrap() {
  try {
    const appearance = await loadAppearanceSetting()
    document.documentElement.dataset.theme = resolveTheme(appearance)
  } catch {
    document.documentElement.dataset.theme = 'light'
  } finally {
    document.documentElement.dataset.themeReady = 'true'
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
