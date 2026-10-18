/**
 * Where the API lives. `null` serves /contracts/fixtures instead, which is how everything is built
 * until J8 (MASTERSPEC 8.3). J8 sets this to '/api' (the dev proxy to :8000), or the demo build
 * sets VITE_API_BASE to the demo laptop. An empty value also means the fixtures, so
 * `VITE_API_BASE= npm run dev` overrides a .env.local that points at the API.
 */
export const API_BASE: string | null = import.meta.env.VITE_API_BASE || null

/**
 * The AI service (MASTERSPEC 7): the dev proxy's /ai beside the live API. With the fixtures it is
 * `null`, and explanations come from the fixture or the web's own template.
 */
export const AI_BASE: string | null = import.meta.env.VITE_AI_BASE || (API_BASE === null ? null : '/ai')

/** Every request gives up after 3 s (MASTERSPEC 6.1); J9 then falls back to the demo cache. */
export const TIMEOUT_MS = 3000

/**
 * The explanation loads after the result is on screen, behind a skeleton (MASTERSPEC 6.4), and a
 * Gemini call with one validator retry can take several seconds, so it gets longer.
 */
export const EXPLAIN_TIMEOUT_MS = 20000

/** GET /search returns at most this many results (MASTERSPEC 3.3). */
export const SEARCH_LIMIT = 8
