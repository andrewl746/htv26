import type { Feature, Geometry, Polygon } from 'geojson'

// "Near your lot" (MASTERSPEC decision 19, 6.5): the circle drawn around a checked lot and the count
// of this ward's lots where a design may fit inside it. Pure functions, no map and no React. This is
// the one place in the app that measures distance on the sphere with a flat-earth approximation
// instead of in EPSG:2952: it is a display count, labelled as an upper bound, and off by well under
// 0.5% within 1 km.

/** Metres per degree of longitude at the equator, and per degree of latitude (decision 19). */
export const METRES_PER_DEGREE_LON = 111_320
export const METRES_PER_DEGREE_LAT = 110_540
/** The circle is a polygon with this many corners. */
export const RING_SEGMENTS = 64

export interface LonLat {
  lon: number
  lat: number
}

const RAD = Math.PI / 180

/** Flat-earth east-west and north-south offsets, in metres, from `origin` to `point`. */
function offsetMetres(origin: LonLat, point: LonLat): { dx: number; dy: number } {
  return {
    dx: (point.lon - origin.lon) * Math.cos(origin.lat * RAD) * METRES_PER_DEGREE_LON,
    dy: (point.lat - origin.lat) * METRES_PER_DEGREE_LAT,
  }
}

/** True when `point` is no farther than `radiusM` metres from `origin`. */
export function isWithin(origin: LonLat, point: LonLat, radiusM: number): boolean {
  const { dx, dy } = offsetMetres(origin, point)
  return dx * dx + dy * dy <= radiusM * radiusM
}

type Ring = number[][]

/** Area-weighted centroid of one ring, or null for a ring with no area. */
function ringCentroid(ring: Ring): { x: number; y: number; area: number } | null {
  if (ring.length < 4) return null
  // Work relative to the first corner: degrees are large and lots are tiny, so the raw cross
  // products would cancel to nothing.
  const [x0, y0] = ring[0]
  let cross = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const ax = ring[i][0] - x0
    const ay = ring[i][1] - y0
    const bx = ring[i + 1][0] - x0
    const by = ring[i + 1][1] - y0
    const step = ax * by - bx * ay
    cross += step
    cx += (ax + bx) * step
    cy += (ay + by) * step
  }
  if (cross === 0) return null
  return { x: x0 + cx / (3 * cross), y: y0 + cy / (3 * cross), area: Math.abs(cross / 2) }
}

/**
 * The centroid of a lot's polygon (the largest part of a multipolygon, holes ignored), or null for
 * a geometry that is not a polygon or has no area.
 */
export function polygonCentroid(geometry: Geometry): LonLat | null {
  const parts: Ring[] = geometry.type === 'Polygon' ? [geometry.coordinates[0]] : geometry.type === 'MultiPolygon' ? geometry.coordinates.map((p) => p[0]) : []
  let best: { x: number; y: number; area: number } | null = null
  for (const ring of parts) {
    const c = ring ? ringCentroid(ring) : null
    if (c && (best === null || c.area > best.area)) best = c
  }
  return best && { lon: best.x, lat: best.y }
}

/** A lot as the count needs it: its best result and its geometry. */
export interface CountableLot {
  geometry: Geometry
  properties: { b: string }
}

/**
 * How many of these lots have a best result of "fits" and a centroid within `radiusM` of `origin`.
 * An upper bound (a design may fit, not will be built); never a list.
 */
export function countFitsNear(lots: readonly CountableLot[], origin: LonLat, radiusM: number): number {
  let count = 0
  for (const lot of lots) {
    if (lot.properties.b !== 'fits') continue
    const centre = polygonCentroid(lot.geometry)
    if (centre && isWithin(origin, centre, radiusM)) count++
  }
  return count
}

/** The circle of `radiusM` metres around `origin` as a closed GeoJSON polygon in lon/lat. */
export function circleRing(origin: LonLat, radiusM: number): Feature<Polygon> {
  const coordinates: [number, number][] = []
  const metresPerLon = Math.cos(origin.lat * RAD) * METRES_PER_DEGREE_LON
  for (let i = 0; i < RING_SEGMENTS; i++) {
    const angle = (2 * Math.PI * i) / RING_SEGMENTS
    coordinates.push([origin.lon + (radiusM * Math.cos(angle)) / metresPerLon, origin.lat + (radiusM * Math.sin(angle)) / METRES_PER_DEGREE_LAT])
  }
  coordinates.push(coordinates[0])
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coordinates] } }
}
