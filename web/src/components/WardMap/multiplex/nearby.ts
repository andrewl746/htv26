import engineConfig from '@contracts/engine_config.json'
import type { Feature, Polygon } from 'geojson'
import type { MultiplexCollection, MxStatus, MxStructure, MxWork } from './types'

// The permitted multiplexes near one point (an address): a count, a breakdown and the nearest rows.
// Street names only; the permit points carry no house numbers.

export const DEFAULT_RADIUS_M: number = engineConfig.nearby_permits_radius_m
export const DEFAULT_SINCE: string = engineConfig.permits_since

export interface NearbyItem {
  id: number
  street: string
  /** Metres from the centre, rounded to the nearest 10 m. */
  distanceM: number
  units: number
  work: MxWork
  status: MxStatus
  structure: MxStructure
  issued: string
}

export interface NearbySummary {
  radiusM: number
  since: string
  count: number
  /** Gross units across the permits counted. */
  units: number
  byWork: Record<MxWork, number>
  byStatus: Record<MxStatus, number>
  /** Every permit within the radius, nearest first. */
  items: NearbyItem[]
}

const EARTH_RADIUS_M = 6_371_008.8
const DEG = Math.PI / 180
const ROUND_TO_M = 10

/** Metres per degree of latitude on the sphere above. */
const M_PER_DEG_LAT = EARTH_RADIUS_M * DEG

function haversineM(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const dLat = (lat2 - lat1) * DEG
  const dLon = (lon2 - lon1) * DEG
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)))
}

/**
 * The permits issued on or after `since` within `radiusM` of `centre`, nearest first.
 *
 * Distances are haversine on WGS84 degrees (spherical earth). That is a screening-level
 * approximation: the error is under 0.1% at these distances. It is not the engine's own count:
 * the engine's permits_nearby is measured from the lot centroid in EPSG:2952 over permits.geojson,
 * so the two can differ by a permit or two at the edge of the circle.
 */
export function nearbyMultiplexes(
  c: MultiplexCollection,
  centre: { lon: number; lat: number },
  opts: { radiusM?: number; since?: string } = {},
): NearbySummary {
  const radiusM = opts.radiusM ?? DEFAULT_RADIUS_M
  const since = opts.since ?? DEFAULT_SINCE
  // Bounding-box prefilter: cheap comparisons before any trigonometry.
  const dLat = radiusM / M_PER_DEG_LAT
  const dLon = dLat / Math.max(Math.cos(centre.lat * DEG), 1e-6)

  const found: { item: NearbyItem; exact: number }[] = []
  for (const f of c.features) {
    const [lon, lat] = f.geometry.coordinates
    if (Math.abs(lat - centre.lat) > dLat || Math.abs(lon - centre.lon) > dLon) continue
    const p = f.properties
    if (p.issued < since) continue
    const exact = haversineM(centre.lon, centre.lat, lon, lat)
    if (exact > radiusM) continue
    found.push({
      exact,
      item: {
        id: p.id,
        street: p.street,
        distanceM: Math.round(exact / ROUND_TO_M) * ROUND_TO_M,
        units: p.units,
        work: p.work,
        status: p.status,
        structure: p.structure,
        issued: p.issued,
      },
    })
  }
  // Nearest first by the exact distance; the id breaks ties so the order never shuffles.
  found.sort((a, b) => a.exact - b.exact || a.item.id - b.item.id)

  const byWork: Record<MxWork, number> = { new_build: 0, conversion: 0 }
  const byStatus: Record<MxStatus, number> = { active: 0, cleared: 0 }
  let units = 0
  for (const { item } of found) {
    byWork[item.work] += 1
    byStatus[item.status] += 1
    units += item.units
  }
  return { radiusM, since, count: found.length, units, byWork, byStatus, items: found.map((x) => x.item) }
}

const CIRCLE_STEPS = 64

/** A circle of `radiusM` metres around `centre`, as a GeoJSON polygon feature for the map. */
export function circlePolygon(centre: { lon: number; lat: number }, radiusM: number, steps: number = CIRCLE_STEPS): Feature<Polygon> {
  const dLat = radiusM / M_PER_DEG_LAT
  const dLon = dLat / Math.cos(centre.lat * DEG)
  const ring: [number, number][] = []
  for (let i = 0; i < steps; i += 1) {
    const angle = (2 * Math.PI * i) / steps
    ring.push([centre.lon + dLon * Math.sin(angle), centre.lat + dLat * Math.cos(angle)])
  }
  ring.push(ring[0])
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }
}

/**
 * Self-check, pure: the numbers a human can compare with an independent brute-force run.
 * Returns the count, the unit total and the three nearest items for a centre.
 */
export function selfCheck(c: MultiplexCollection, centre: { lon: number; lat: number }) {
  const s = nearbyMultiplexes(c, centre)
  return { count: s.count, units: s.units, nearest: s.items.slice(0, 3) }
}
