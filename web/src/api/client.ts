import type { CheckResponse, ExplainRequest, ExplainResponse, SearchResponse } from '@contracts/types'
import { AI_BASE, API_BASE, DEMO_ONLY, EXPLAIN_TIMEOUT_MS, SEARCH_LIMIT, TIMEOUT_MS } from './config'
import { cachedFile, demoCacheName } from './demoCache'
import { ApiError, apiCode } from './errors'
import { explainFromTemplate } from './explainTemplate'
import * as fixtures from './fixtures'

// The one fetch wrapper (MASTERSPEC 6.1). Responses are typed by @contracts/types and never reshaped.
// When the API does not answer in time, or fails on its side, the same request is answered from
// public/demo-cache/ if a file there matches it (6.7); `?demo=1` goes to the cache first.

/** Everything except an answer the API meant: "not found" and "outside Toronto" are real answers. */
function cacheable(error: unknown): boolean {
  return error instanceof ApiError && (error.code === 'timeout' || error.code === 'network' || error.code === 'server')
}

async function getLive<T>(base: string, path: string, signal: AbortSignal | undefined, timeoutMs: number): Promise<T> {
  const timeout = AbortSignal.timeout(timeoutMs)
  let response: Response
  try {
    response = await fetch(`${base}${path}`, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new ApiError(timeout.aborted ? 'timeout' : 'network')
  }
  if (!response.ok) {
    throw new ApiError(apiCode(await response.json().catch(() => null)), response.status)
  }
  return (await response.json()) as T
}

/** GET an API path (with its query string), falling back to the demo cache. */
export async function getApiJson<T>(path: string, { signal, timeoutMs = TIMEOUT_MS }: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<T> {
  const base = API_BASE ?? ''
  const name = demoCacheName(path)
  if (DEMO_ONLY && name) {
    const hit = await cachedFile<T>(name, signal)
    if (hit !== null) return hit
  }
  try {
    return await getLive<T>(base, path, signal, timeoutMs)
  } catch (error) {
    if (signal?.aborted || !name || DEMO_ONLY || !cacheable(error)) throw error
    const hit = await cachedFile<T>(name, signal)
    if (hit === null) throw error
    return hit
  }
}

/** Address autocomplete; the caller keeps queries to 2 characters or more. */
export function search(query: string, signal?: AbortSignal): Promise<SearchResponse> {
  if (API_BASE === null) return fixtures.search(query, SEARCH_LIMIT)
  const params = new URLSearchParams({ q: query, limit: String(SEARCH_LIMIT) })
  return getApiJson(`/search?${params}`, { signal })
}

/** By address from the search, or by lot from a click on the ward map. */
export type CheckQuery = { address_id: string } | { lot_id: string }

export function check(query: CheckQuery, signal?: AbortSignal): Promise<CheckResponse> {
  if (API_BASE === null) return fixtures.check(query)
  return getApiJson(`/check?${new URLSearchParams(query)}`, { signal })
}

/**
 * The plain-language explanation (MASTERSPEC 6.4). If the AI service is unreachable, slow or
 * fails, the web writes the same template the service falls back to, so a result always gets one.
 */
export async function explain(request: ExplainRequest, signal?: AbortSignal): Promise<ExplainResponse> {
  if (AI_BASE === null || DEMO_ONLY) return explainFromTemplate(request)
  const timeout = AbortSignal.timeout(EXPLAIN_TIMEOUT_MS)
  try {
    const response = await fetch(`${AI_BASE}/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    })
    if (!response.ok) throw new ApiError(apiCode(await response.json().catch(() => null)), response.status)
    return (await response.json()) as ExplainResponse
  } catch (error) {
    if (signal?.aborted) throw error
    return explainFromTemplate(request)
  }
}
