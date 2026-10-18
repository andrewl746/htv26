import type { FeatureCollection, Geometry, Point } from 'geojson'

// Types for the permitted-multiplexes layer. These are new and pending a contract entry from
// Andrew (contracts/types.ts and a schema); until then they live here. Nothing that already
// exists in @contracts/types is redefined.

/** "cleared" = the City closed the permit; "active" = permitted, not necessarily built. */
export type MxStatus = 'active' | 'cleared'
export type MxWork = 'new_build' | 'conversion'
export type MxStructure = 'detached' | 'semi' | 'townhouse' | 'other'

/** One permit point's properties. The street name only: never an address number. */
export interface MultiplexProps {
  id: number
  street: string
  /** "01".."25" */
  ward: string
  /** Gross units the permit creates (2 to 6). */
  units: number
  structure: MxStructure
  work: MxWork
  status: MxStatus
  /** ISO date, YYYY-MM-DD. */
  issued: string
}

export type MultiplexCollection = FeatureCollection<Point, MultiplexProps>

export interface WardShape {
  /** "01".."25" */
  ward: string
  name: string
}

export type WardShapeCollection = FeatureCollection<Geometry, WardShape>

/** What the filter panel has selected; a permit shows only if it matches all three lists. */
export interface MultiplexFilters {
  units: number[]
  status: MxStatus[]
  work: MxWork[]
}

/** The unit counts the filter offers. */
export const UNIT_OPTIONS = [2, 3, 4, 5, 6] as const

/** Everything selected: nothing is filtered out. */
export const DEFAULT_FILTERS: MultiplexFilters = {
  units: [...UNIT_OPTIONS],
  status: ['cleared', 'active'],
  work: ['new_build', 'conversion'],
}

/** A ward's totals under the current filters. */
export interface WardCount {
  permits: number
  units: number
  active: number
  cleared: number
}
