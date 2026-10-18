import { DEFAULT_FILTERS, type MultiplexCollection, type MultiplexFilters, type MultiplexProps, type WardCount } from './types'

/** Ward ids run "01" to "25". */
const WARD_TOTAL = 25
const WARD_ID_WIDTH = 2

export const WARD_IDS: readonly string[] = Array.from({ length: WARD_TOTAL }, (_, i) => String(i + 1).padStart(WARD_ID_WIDTH, '0'))

function matches(p: MultiplexProps, f: MultiplexFilters): boolean {
  return f.units.includes(p.units) && f.status.includes(p.status) && f.work.includes(p.work)
}

/** A new collection of only the permits that match; the feature objects themselves are kept. */
export function applyFilters(c: MultiplexCollection, f: MultiplexFilters): MultiplexCollection {
  return { ...c, features: c.features.filter((feature) => matches(feature.properties, f)) }
}

/** Per-ward totals for the permits that match. Every ward is present, zeros included. */
export function wardCounts(c: MultiplexCollection, f: MultiplexFilters): Record<string, WardCount> {
  const counts: Record<string, WardCount> = {}
  for (const id of WARD_IDS) counts[id] = { permits: 0, units: 0, active: 0, cleared: 0 }
  for (const { properties: p } of c.features) {
    const count = counts[p.ward]
    if (!count || !matches(p, f)) continue
    count.permits += 1
    count.units += p.units
    count[p.status] += 1
  }
  return counts
}

function sameSet<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((v) => b.includes(v))
}

/** True when nothing is filtered out (everything is selected). */
export function isDefaultFilters(f: MultiplexFilters): boolean {
  return sameSet(f.units, DEFAULT_FILTERS.units) && sameSet(f.status, DEFAULT_FILTERS.status) && sameSet(f.work, DEFAULT_FILTERS.work)
}

/** Adds the value if it is missing, removes it if present; returns a new list. */
export function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}
