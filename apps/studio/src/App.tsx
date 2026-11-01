import { useEffect, useState } from 'react'
import { safeStorage } from './data/backend'
import { usePendingCount, useStore } from './data/store'
import { AiPage } from './pages/Ai'
import { ComponentsPage } from './pages/Components'
import { FlowsPage } from './pages/Flows'
import { PlaygroundPage } from './pages/Playground'
import { PublishPage } from './pages/Publish'
import { ScreensPage } from './pages/Screens'
import { useRoute, type Route } from './router'
import {
  IconComponents,
  IconFlows,
  IconMoon,
  IconPlayground,
  IconPublish,
  IconScreens,
  IconSpark,
  IconSun,
  Mark,
} from './ui/icons'

export const REPO_URL = 'https://github.com/mauriciomsouza/freshed'

const local = safeStorage('local')

const titles: Record<Route['page'], string> = {
  screens: 'Screens',
  flows: 'Flows',
  components: 'Components',
  playground: 'Playground',
  publish: 'Publish',
  ai: 'Generate with AI',
}

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark' | null>(() => {
    const t = local.get('freshed:theme')
    return t === 'light' || t === 'dark' ? t : null
  })
  useEffect(() => {
    const root = document.documentElement
    if (theme) root.dataset.theme = theme
    else delete root.dataset.theme
  }, [theme])
  const effective =
    theme ?? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  return {
    effective,
    toggle: () => {
      const next = effective === 'dark' ? 'light' : 'dark'
      local.set('freshed:theme', next)
      setTheme(next)
    },
  }
}

export function App() {
  const [route, navigate] = useRoute()
  const { backend, ready, toastMessage, status, reset, toast } = useStore()
  const pending = usePendingCount()
  const theme = useTheme()
  const [bannerHidden, setBannerHidden] = useState(() => local.get('freshed:banner') === 'hidden')

  const nav: { page: Route['page']; icon: React.ReactNode; count?: number }[] = [
    { page: 'screens', icon: <IconScreens /> },
    { page: 'flows', icon: <IconFlows /> },
    { page: 'components', icon: <IconComponents /> },
    { page: 'playground', icon: <IconPlayground /> },
  ]

  useEffect(() => {
    document.title = `${titles[route.page]} · freshed`
  }, [route.page])

  return (
    <div
      className="shell"
      style={backend.kind !== 'demo' || bannerHidden ? { gridTemplateRows: '0 1fr' } : undefined}
    >
      {backend.kind === 'demo' && !bannerHidden ? (
        <div className="banner" role="note">
          <span>
            <strong>Demo mode.</strong> Data stays in your browser.
          </span>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            Self-host freshed
          </a>
          {reset ? (
            <button
              onClick={async () => {
                await reset()
                toast('Demo data reset')
              }}
            >
              Reset demo
            </button>
          ) : null}
          <button
            aria-label="Hide banner"
            onClick={() => {
              local.set('freshed:banner', 'hidden')
              setBannerHidden(true)
            }}
          >
            Hide
          </button>
        </div>
      ) : (
        <div />
      )}
      <nav className="sidebar" aria-label="Studio">
        <div className="brand">
          <Mark className="brand-mark" />
          <span className="brand-name">freshed</span>
        </div>
        <div className="project">
          <span className="project-avatar" aria-hidden>
            B
          </span>
          <span>
            <div className="project-name">Brew</div>
            <div className="project-meta">Coffee subscription app</div>
          </span>
        </div>
        <div className="nav-group">
          {nav.map((n) => (
            <a
              key={n.page}
              className="nav-item"
              href={`#/${n.page}`}
              aria-current={route.page === n.page ? 'page' : undefined}
            >
              {n.icon}
              {titles[n.page]}
            </a>
          ))}
        </div>
        <div className="nav-gap" />
        <div className="nav-group">
          <a
            className="nav-item"
            href="#/ai"
            aria-current={route.page === 'ai' ? 'page' : undefined}
          >
            <IconSpark />
            Generate with AI
          </a>
          <a
            className="nav-item"
            href="#/publish"
            aria-current={route.page === 'publish' ? 'page' : undefined}
          >
            <IconPublish />
            Publish
            {pending ? (
              <span className="nav-count" aria-label={`${pending} unpublished changes`}>
                {pending}
              </span>
            ) : null}
          </a>
        </div>
        <div className="sidebar-foot">
          <span className="live-line">
            <span className="dot dot-live" />v{status?.live?.number ?? '–'} live
          </span>
          <button
            className="nav-item"
            style={{ height: 28, padding: '0 6px', margin: '0 -6px' }}
            onClick={theme.toggle}
          >
            {theme.effective === 'dark' ? <IconSun /> : <IconMoon />}
            {theme.effective === 'dark' ? 'Light theme' : 'Dark theme'}
          </button>
        </div>
      </nav>
      <main className="main">
        <header className="page-head">
          <h1 className="page-title">{titles[route.page]}</h1>
          <span className="spacer" />
          {pending && route.page !== 'publish' ? (
            <a className="btn" href="#/publish">
              <span className="dot dot-draft" />
              {pending} unpublished
            </a>
          ) : null}
        </header>
        {!ready ? (
          <div className="empty">Loading…</div>
        ) : route.page === 'screens' ? (
          <ScreensPage slug={route.slug} navigate={navigate} />
        ) : route.page === 'flows' ? (
          <FlowsPage slug={route.slug} navigate={navigate} />
        ) : route.page === 'components' ? (
          <ComponentsPage name={route.name} navigate={navigate} />
        ) : route.page === 'playground' ? (
          <PlaygroundPage />
        ) : route.page === 'publish' ? (
          <PublishPage />
        ) : (
          <AiPage navigate={navigate} />
        )}
      </main>
      {toastMessage ? (
        <div className="toast" role="status" key={toastMessage.id}>
          {toastMessage.text}
        </div>
      ) : null}
    </div>
  )
}
