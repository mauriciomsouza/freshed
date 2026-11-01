import { useCallback, useEffect, useState } from 'react'

/**
 * Hash routing, so deep links work on static hosts like GitHub Pages
 * (`/freshed/#/flows/onboarding`) without server rewrites.
 */
export type Route =
  | { page: 'screens'; slug?: string }
  | { page: 'flows'; slug?: string }
  | { page: 'components'; name?: string }
  | { page: 'playground' }
  | { page: 'publish' }
  | { page: 'ai' }

export function parseHash(hash: string): Route {
  const [page, param] = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent)
  switch (page) {
    case 'flows':
      return { page: 'flows', slug: param || undefined }
    case 'components':
      return { page: 'components', name: param || undefined }
    case 'playground':
      return { page: 'playground' }
    case 'publish':
      return { page: 'publish' }
    case 'ai':
      return { page: 'ai' }
    case 'screens':
    default:
      return { page: 'screens', slug: page === 'screens' ? param || undefined : undefined }
  }
}

export function toHash(route: Route): string {
  const param = 'slug' in route ? route.slug : 'name' in route ? route.name : undefined
  return `#/${route.page}${param ? `/${encodeURIComponent(param)}` : ''}`
}

export function useRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  const navigate = useCallback((r: Route) => {
    window.location.hash = toHash(r)
  }, [])
  return [route, navigate]
}
