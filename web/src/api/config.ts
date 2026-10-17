/**
 * Where the API lives. `null` serves /contracts/fixtures instead, which is how everything is built
 * until J8 (MASTERSPEC 8.3). J8 sets this to '/api' (the dev proxy to :8000), or the demo build
 * sets VITE_API_BASE to the demo laptop.
 */
export const API_BASE: string | null = import.meta.env.VITE_API_BASE ?? null

/** Every request gives up after 3 s (MASTERSPEC 6.1); J9 then falls back to the demo cache. */
export const TIMEOUT_MS = 3000

/** GET /search returns at most this many results (MASTERSPEC 3.3). */
export const SEARCH_LIMIT = 8
