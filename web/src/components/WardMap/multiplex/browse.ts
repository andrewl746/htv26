import { applyFilters, isDefaultFilters } from './filters'
import { nearbyMultiplexes } from './nearby'
import {
  DEFAULT_FILTERS,
  UNIT_OPTIONS,
  type MultiplexCollection,
  type MultiplexFilters,
  type MultiplexProps,
  type MxStatus,
  type MxStructure,
  type MxWork,
} from './types'

// The pure half of the "search for permitted multiplexes" page: what the filters, the search box and
// the sort do to the permit points, and how that state travels in the address bar. Nothing here
// touches the DOM. Street names only: the permit points carry no house numbers.

export type BrowseSort = 'newest' | 'units' | 'street' | 'nearest'

/** The sort keys the page offers, in menu order. Wording lives in browseCopy. */
export const SORT_KEYS: readonly BrowseSort[] = ['newest', 'units', 'street', 'nearest']

export const STRUCTURES: readonly MxStructure[] = ['detached', 'semi', 'townhouse', 'other']
export const STATUSES: readonly MxStatus[] = ['cleared', 'active']
export const WORKS: readonly MxWork[] = ['new_build', 'conversion']

/** "No limit" for the issued-year range. Real years are compared against these. */
export const NO_YEAR_FROM = 0
export const NO_YEAR_TO = 9999

/** Cards shown at a time; "Show more" adds this many. */
export const PAGE_SIZE = 25

export interface BrowseState {
  /** Free text: a street name or a ward name or number. */
  query: string
  filters: MultiplexFilters
  structures: MxStructure[]
  /** "01".."25", or '' for every ward. */
  ward: string
  fromYear: number
  toYear: number
  /** Keep only the permits inside the map's last reported bounds. */
  onlyInView: boolean
  sort: BrowseSort
}

export const DEFAULT_BROWSE: BrowseState = {
  query: '',
  filters: DEFAULT_FILTERS,
  structures: [...STRUCTURES],
  ward: '',
  fromYear: NO_YEAR_FROM,
  toYear: NO_YEAR_TO,
  onlyInView: false,
  sort: 'newest',
}

export interface LonLat {
  lon: number
  lat: number
}

export interface Bounds {
  west: number
  south: number
  east: number
  north: number
}

/** One permit as the list shows it. */
export type BrowseItem = MultiplexProps & {
  /** Metres from the chosen place, rounded to 10 m; null when no place is chosen. */
  distanceM: number | null
  lon: number
  lat: number
  wardName: string
}

export interface BrowseContext {
  near: LonLat | null
  bounds: Bounds | null
  wardNames: Record<string, string>
}

export interface BrowseResult {
  items: BrowseItem[]
  /** Exactly the permits in `items`, for the map to draw. */
  permits: MultiplexCollection
}

const WARD_DIGITS = /^\d{1,2}$/
const WARD_PREFIX = /^ward\s+/
const WARD_ID_WIDTH = 2

/** The calendar year of an ISO date; NaN when it does not parse. */
export function issuedYear(issued: string): number {
  return Number.parseInt(issued.slice(0, 4), 10)
}

function matchesQuery(p: MultiplexProps, wardName: string, q: string): boolean {
  if (!q) return true
  if (p.street.toLowerCase().includes(q)) return true
  if (wardName.toLowerCase().includes(q)) return true
  // "04", "4" or "ward 4" name a ward by its number.
  const digits = q.replace(WARD_PREFIX, '')
  return WARD_DIGITS.test(digits) && digits.padStart(WARD_ID_WIDTH, '0') === p.ward
}

const collator = new Intl.Collator('en-CA', { sensitivity: 'base', numeric: true })

/** Newest issue date first; the id keeps ties in a fixed order. */
const byNewest = (a: BrowseItem, b: BrowseItem) => (a.issued < b.issued ? 1 : a.issued > b.issued ? -1 : b.id - a.id)

/**
 * The permits the page shows: search text, filters, year range, ward, "only what is on the map",
 * then the sort. Pure; `c` is never changed. Distances come from nearbyMultiplexes (haversine, the
 * same helper the address check uses) with the radius and the since-date switched off.
 */
export function browse(c: MultiplexCollection, s: BrowseState, ctx: BrowseContext): BrowseResult {
  const q = s.query.trim().toLowerCase()
  const byFilters = applyFilters(c, s.filters).features

  const kept = byFilters.filter((f) => {
    const p = f.properties
    const wardName = ctx.wardNames[p.ward] ?? ''
    if (!s.structures.includes(p.structure)) return false
    if (s.ward && p.ward !== s.ward) return false
    const year = issuedYear(p.issued)
    if (year < s.fromYear || year > s.toYear) return false
    if (!matchesQuery(p, wardName, q)) return false
    if (s.onlyInView && ctx.bounds) {
      const [lon, lat] = f.geometry.coordinates
      const { west, south, east, north } = ctx.bounds
      if (lon < west || lon > east || lat < south || lat > north) return false
    }
    return true
  })

  // Rank by exact distance (nearbyMultiplexes sorts by it); the rounded value is what is shown.
  const ranked = new Map<number, { rank: number; distanceM: number }>()
  if (ctx.near) {
    const all = nearbyMultiplexes({ ...c, features: kept }, ctx.near, { radiusM: Infinity, since: '' })
    all.items.forEach((item, rank) => ranked.set(item.id, { rank, distanceM: item.distanceM }))
  }

  const rows = kept.map((f) => {
    const p = f.properties
    const [lon, lat] = f.geometry.coordinates
    const item: BrowseItem = { ...p, lon, lat, wardName: ctx.wardNames[p.ward] ?? '', distanceM: ranked.get(p.id)?.distanceM ?? null }
    return { feature: f, item }
  })

  const order = (a: (typeof rows)[number], b: (typeof rows)[number]): number => {
    switch (s.sort) {
      case 'nearest':
        if (ctx.near) return (ranked.get(a.item.id)?.rank ?? 0) - (ranked.get(b.item.id)?.rank ?? 0)
        return byNewest(a.item, b.item)
      case 'units':
        return b.item.units - a.item.units || byNewest(a.item, b.item)
      case 'street':
        return collator.compare(a.item.street, b.item.street) || byNewest(a.item, b.item)
      default:
        return byNewest(a.item, b.item)
    }
  }
  rows.sort(order)

  return {
    items: rows.map((r) => r.item),
    permits: { ...c, features: rows.map((r) => r.feature) },
  }
}

/** Total gross units across the items. */
export function totalUnits(items: readonly BrowseItem[]): number {
  return items.reduce((sum, item) => sum + item.units, 0)
}

/** The first and last issue years in the data, or null for an empty collection. */
export function yearRange(c: MultiplexCollection): { min: number; max: number } | null {
  let min = Infinity
  let max = -Infinity
  for (const f of c.features) {
    const y = issuedYear(f.properties.issued)
    if (Number.isNaN(y)) continue
    if (y < min) min = y
    if (y > max) max = y
  }
  return min <= max ? { min, max } : null
}

/** How many of the filter controls differ from their defaults (not counting the search text). */
export function activeFilterCount(s: BrowseState): number {
  let n = 0
  if (!isDefaultFilters(s.filters)) n += 1
  if (s.structures.length !== STRUCTURES.length) n += 1
  if (s.ward) n += 1
  if (s.fromYear !== NO_YEAR_FROM || s.toYear !== NO_YEAR_TO) n += 1
  if (s.onlyInView) n += 1
  return n
}

/** True when nothing narrows the list: no text, no filter, no map restriction. */
export function isDefaultBrowse(s: BrowseState): boolean {
  return s.query.trim() === '' && activeFilterCount(s) === 0
}

/** Resets the search text and every filter; the sort is the person's choice and stays. */
export function clearedBrowse(s: BrowseState): BrowseState {
  return { ...DEFAULT_BROWSE, sort: s.sort }
}

// ---------- the address bar ----------

/** The only query-string keys the page ever writes. */
export const PARAM = {
  query: 'q',
  units: 'units',
  status: 'status',
  work: 'work',
  structure: 'structure',
  ward: 'ward',
  from: 'from',
  to: 'to',
  sort: 'sort',
  near: 'near',
} as const

/** A position outside this box is not the City of Toronto (screening-level, not a boundary). */
const TORONTO_BOX = { lonMin: -79.65, lonMax: -79.1, latMin: 43.55, latMax: 43.86 } as const
/** Decimal places kept for a shared position (about 1 m): no more than a street needs. */
const NEAR_DECIMALS = 4
const MAX_QUERY_CHARS = 80

function list<T extends string | number>(raw: string | null, allowed: readonly T[], parse: (v: string) => T | undefined): T[] | null {
  if (raw === null) return null
  const picked = raw.split(',').map(parse).filter((v): v is T => v !== undefined && allowed.includes(v))
  return picked.length ? [...new Set(picked)] : null
}

function year(raw: string | null, fallback: number): number {
  const n = raw === null ? Number.NaN : Number.parseInt(raw, 10)
  return Number.isFinite(n) && n >= 1900 && n <= 2999 ? n : fallback
}

/** Reads `?q=&units=&status=…` into a state and a near point. Unknown or malformed values are ignored. */
export function parseBrowseParams(search: string): { state: BrowseState; near: LonLat | null } {
  const p = new URLSearchParams(search)
  const sort = p.get(PARAM.sort)
  const nearRaw = p.get(PARAM.near)
  let near: LonLat | null = null
  if (nearRaw) {
    const [lon, lat] = nearRaw.split(',').map(Number)
    const inside = lon >= TORONTO_BOX.lonMin && lon <= TORONTO_BOX.lonMax && lat >= TORONTO_BOX.latMin && lat <= TORONTO_BOX.latMax
    if (Number.isFinite(lon) && Number.isFinite(lat) && inside) near = { lon, lat }
  }
  const wardRaw = p.get(PARAM.ward) ?? ''
  const state: BrowseState = {
    ...DEFAULT_BROWSE,
    query: (p.get(PARAM.query) ?? '').slice(0, MAX_QUERY_CHARS),
    filters: {
      units: list(p.get(PARAM.units), UNIT_OPTIONS, Number) ?? DEFAULT_FILTERS.units,
      status: list(p.get(PARAM.status), STATUSES, (v) => v as MxStatus) ?? DEFAULT_FILTERS.status,
      work: list(p.get(PARAM.work), WORKS, (v) => v as MxWork) ?? DEFAULT_FILTERS.work,
    },
    structures: list(p.get(PARAM.structure), STRUCTURES, (v) => v as MxStructure) ?? DEFAULT_BROWSE.structures,
    ward: /^\d{2}$/.test(wardRaw) ? wardRaw : '',
    fromYear: year(p.get(PARAM.from), NO_YEAR_FROM),
    toYear: year(p.get(PARAM.to), NO_YEAR_TO),
    // "Nearest" without a place has nothing to measure from.
    sort: SORT_KEYS.includes(sort as BrowseSort) && (sort !== 'nearest' || near) ? (sort as BrowseSort) : 'newest',
  }
  return { state, near }
}

/** The query string (with a leading "?", or '' when nothing differs from the defaults). */
export function browseToParams(s: BrowseState, near: LonLat | null): string {
  const p = new URLSearchParams()
  const q = s.query.trim()
  if (q) p.set(PARAM.query, q)
  const set = (key: string, picked: readonly (string | number)[], all: readonly (string | number)[]) => {
    if (picked.length !== all.length || !all.every((v) => picked.includes(v))) p.set(key, picked.join(','))
  }
  set(PARAM.units, s.filters.units, DEFAULT_FILTERS.units)
  set(PARAM.status, s.filters.status, DEFAULT_FILTERS.status)
  set(PARAM.work, s.filters.work, DEFAULT_FILTERS.work)
  set(PARAM.structure, s.structures, STRUCTURES)
  if (s.ward) p.set(PARAM.ward, s.ward)
  if (s.fromYear !== NO_YEAR_FROM) p.set(PARAM.from, String(s.fromYear))
  if (s.toYear !== NO_YEAR_TO) p.set(PARAM.to, String(s.toYear))
  if (s.sort !== DEFAULT_BROWSE.sort) p.set(PARAM.sort, s.sort)
  if (near) p.set(PARAM.near, `${near.lon.toFixed(NEAR_DECIMALS)},${near.lat.toFixed(NEAR_DECIMALS)}`)
  // Commas in a list stay readable ("units=3,4"); everything else keeps its normal escaping.
  const text = p.toString().replaceAll('%2C', ',')
  return text ? `?${text}` : ''
}
