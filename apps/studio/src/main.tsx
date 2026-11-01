import '@fontsource-variable/instrument-sans'
import '@fontsource-variable/jetbrains-mono'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import type { Backend } from './data/backend'
import { demoBackend } from './data/demo'
import { httpBackend } from './data/http'
import { StoreProvider } from './data/store'
import './styles.css'

/**
 * Demo mode (the default, and always on GitHub Pages) runs entirely in the
 * browser. To use a real server, set VITE_FRESHED_API and
 * VITE_FRESHED_ADMIN_KEY when running the Studio locally (never in a
 * public build: the admin key would ship in the bundle).
 */
function pickBackend(): Backend {
  const forced = import.meta.env.VITE_DEMO_FORCED as unknown as boolean
  const api = import.meta.env.VITE_FRESHED_API as string | undefined
  const key = import.meta.env.VITE_FRESHED_ADMIN_KEY as string | undefined
  if (!forced && api && key) return httpBackend(api, key)
  // `?fresh` starts from the seed data (handy for links in docs and for screenshots).
  const params = new URLSearchParams(window.location.search)
  if (params.has('fresh')) {
    params.delete('fresh')
    const query = params.toString()
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`,
    )
    return demoBackend({ reset: true })
  }
  return demoBackend()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider backend={pickBackend()}>
      <App />
    </StoreProvider>
  </StrictMode>,
)
