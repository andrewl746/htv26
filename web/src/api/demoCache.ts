// The web's copy of the demo cache (MASTERSPEC 6.7): full API answers for the demo addresses and the
// demo ward in public/demo-cache/, written by `python -m api.cache_demo` (A11). The file names are
// api/demo_cache.py's `cache_name`, so one writer fills both the API's cache and this one.

const DIR = `${import.meta.env.BASE_URL}demo-cache/`
const SEARCH_MIN_CHARS = 2
const ID = /^\d{1,12}$/
const WARD = /^(0[1-9]|1[0-9]|2[0-5])$/
const ROUTES: [RegExp, (id: string) => string][] = [
  [/^\/ward\/([^/]+)$/, (id) => `ward.${id}.json`],
  [/^\/ward\/([^/]+)\/trend$/, (id) => `trend.${id}.json`],
  [/^\/static\/wards\/([^/]+)\.geojson$/, (id) => `lots.${id}.geojson`],
]

/** Lowercased, whitespace collapsed, then runs of anything but a-z and 0-9 as one '-' (api/demo_cache.py search_slug). */
function searchSlug(q: string): string | null {
  const norm = q.toLowerCase().replace(/\s+/g, ' ').trim()
  if (norm.length < SEARCH_MIN_CHARS) return null
  return norm.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || null
}

/** The cache file that answers GET `pathWithQuery`, or null when such a request is never cached. */
export function demoCacheName(pathWithQuery: string): string | null {
  const url = new URL(pathWithQuery, 'http://cache.invalid')
  const path = url.pathname
  const params = url.searchParams
  if (path === '/search') {
    const slug = searchSlug(params.get('q') ?? '')
    return slug && `search.${slug}.json`
  }
  if (path === '/check') {
    const addressId = (params.get('address_id') ?? '').trim()
    const lotId = (params.get('lot_id') ?? '').trim()
    if (addressId && !lotId && ID.test(addressId)) return `check.${addressId}.json`
    if (lotId && !addressId && ID.test(lotId)) return `check.lot.${lotId}.json`
    return null
  }
  if (path === '/static/permits.geojson') return 'permits.geojson'
  for (const [pattern, name] of ROUTES) {
    const m = path.match(pattern)
    if (m && WARD.test(m[1])) return name(m[1])
  }
  return null
}

type Listener = () => void
const listeners = new Set<Listener>()

/** Called whenever an answer came from the cache, so the app can show its "cached" badge. */
export function onCacheUsed(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The cached answer, or null when there is no such file (Vite and `vite preview` answer a missing file with index.html). */
export async function cachedFile<T>(name: string, signal?: AbortSignal): Promise<T | null> {
  let response: Response
  try {
    response = await fetch(`${DIR}${name}`, { signal })
  } catch (error) {
    if (signal?.aborted) throw error
    return null
  }
  const type = response.headers.get('content-type') ?? ''
  if (!response.ok || type.includes('text/html')) return null
  const body = (await response.json()) as T
  // A cached check says so in its own meta, as the API's cache does (api/demo_cache.py read).
  const meta = name.startsWith('check.') ? (body as { meta?: { cached?: boolean } }).meta : undefined
  if (meta) meta.cached = true
  for (const listener of listeners) listener()
  return body
}
