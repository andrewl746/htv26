import type { CheckResponse, SearchResponse } from '@contracts/types'
import { API_BASE, SEARCH_LIMIT, TIMEOUT_MS } from './config'
import { ApiError, apiCode } from './errors'
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
