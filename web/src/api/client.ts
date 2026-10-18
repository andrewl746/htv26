import type { CheckResponse, ExplainRequest, ExplainResponse, SearchResponse } from '@contracts/types'
import { AI_BASE, API_BASE, EXPLAIN_TIMEOUT_MS, SEARCH_LIMIT, TIMEOUT_MS } from './config'
import { ApiError, apiCode } from './errors'
import { explainFromTemplate } from './explainTemplate'
import * as fixtures from './fixtures'

// The one fetch wrapper (MASTERSPEC 6.1). Responses are typed by @contracts/types and never reshaped.

async function getJson<T>(base: string, path: string, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(`${base}${path}`, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout })
  } catch (error) {
    if (signal?.aborted) throw error
    // J9: serve the matching file from public/demo-cache here before giving up.
    throw new ApiError(timeout.aborted ? 'timeout' : 'network')
  }
  if (!response.ok) {
    throw new ApiError(apiCode(await response.json().catch(() => null)), response.status)
  }
  return (await response.json()) as T
}

/** Address autocomplete; the caller keeps queries to 2 characters or more. */
export function search(query: string, signal?: AbortSignal): Promise<SearchResponse> {
  if (API_BASE === null) return fixtures.search(query, SEARCH_LIMIT)
  const params = new URLSearchParams({ q: query, limit: String(SEARCH_LIMIT) })
  return getJson(API_BASE, `/search?${params}`, signal)
}

/** By address from the search, or by lot from a click on the ward map. */
export type CheckQuery = { address_id: string } | { lot_id: string }

export function check(query: CheckQuery, signal?: AbortSignal): Promise<CheckResponse> {
  if (API_BASE === null) return fixtures.check(query)
  return getJson(API_BASE, `/check?${new URLSearchParams(query)}`, signal)
}

/**
 * The plain-language explanation (MASTERSPEC 6.4). If the AI service is unreachable, slow or
 * fails, the web writes the same template the service falls back to, so a result always gets one.
 */
export async function explain(request: ExplainRequest, signal?: AbortSignal): Promise<ExplainResponse> {
  if (AI_BASE === null) return explainFromTemplate(request)
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
