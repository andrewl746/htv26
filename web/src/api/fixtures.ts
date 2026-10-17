import type { CheckResponse, SearchResponse } from '@contracts/types'
import type { CheckQuery } from './client'
import { ApiError } from './errors'

// Stands in for the API until J8 switches the base URL (MASTERSPEC 6, 8.3). Loaded lazily so a
// build pointed at the live API never downloads them. The JSON imports infer plain strings and
// number[] where the contracts have unions and tuples, hence the casts.

const CHECK_FIXTURES = [
  () => import('@contracts/fixtures/check.borderline.json'),
  () => import('@contracts/fixtures/check.fits.json'),
  () => import('@contracts/fixtures/check.no_fit.json'),
  () => import('@contracts/fixtures/check.not_checked.json'),
]

let checks: Promise<CheckResponse[]> | null = null

function loadChecks(): Promise<CheckResponse[]> {
  checks ??= Promise.all(CHECK_FIXTURES.map(async (load) => (await load()).default as unknown as CheckResponse))
  return checks
}

/** The API matches a prefix of the normalized address (MASTERSPEC 3.3), so the fixtures do too. */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function search(query: string, limit: number): Promise<SearchResponse> {
  const all = (await import('@contracts/fixtures/search.json')).default as unknown as SearchResponse
  const prefix = normalize(query)
  const results = all.results.filter((r) => normalize(r.address_full).startsWith(prefix)).slice(0, limit)
  return { query, results }
}

export async function check(query: CheckQuery): Promise<CheckResponse> {
  const hit = (await loadChecks()).find((c) =>
    'address_id' in query ? c.address.address_id === query.address_id : c.lot.lot_id === query.lot_id,
  )
  if (!hit) throw new ApiError('address_not_found', 404)
  return hit
}
