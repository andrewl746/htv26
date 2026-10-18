import type { ExpressionSpecification, Map as MapLibreMap } from 'maplibre-gl'
import type { Feature, Geometry, Point } from 'geojson'
import engineConfig from '@contracts/engine_config.json'
import type { PermitFeatureProps } from '@contracts/types'
import type { WardData } from '../WardMap/data'
import { addLayers, applyData, applyDesign, applySearched, LOTS, PERMITS } from '../WardMap/layers'

// The lot-to-ward transition on the base map (MASTERSPEC 6.6). The base map draws the ward with the
// ward map's own layers (WardMap/layers.ts), so when the ward map takes over at the end nothing on
// screen changes. Lots fill in a ripple outward from the searched lot as the camera pulls out, then
// the permit dots drop in.
//
// Each lot and dot is switched on and off by feature state, and the layers keep that paint for good:
// MapLibre fails ("expression.evaluate is not a function") when a property swaps between a
// feature-state expression and a plain value while feature-state changes are pending.

const LOT_LAYERS = ['lots-fill', 'lots-stripes', 'lots-outline']
const SEARCHED_LAYERS = ['searched-casing', 'searched']
const DOTS_LAYER = 'permits-dots'
const ALL_LAYERS = [...LOT_LAYERS, ...SEARCHED_LAYERS, DOTS_LAYER]

/** The ripple starts this far out from the lot and grows with the view, so it spreads evenly on screen. */
const RIPPLE_START_M = 25
/** A dot lands a little larger and settles to its size. */
const DOT_DROP_SCALE = 1.8
const DOT_DROP_OPACITY = 0.6
/** The searched lot's outline as the ward map draws it (WardMap/layers.ts). */
const SEARCHED_OPACITY: [layer: string, opacity: number][] = [
  ['searched-casing', 0.5],
  ['searched', 1],
]
const METRES_PER_DEGREE_LAT = 110_540
const METRES_PER_DEGREE_LON = 111_320

type Paint = Parameters<MapLibreMap['setPaintProperty']>[2]
type PaintName = Parameters<MapLibreMap['setPaintProperty']>[1]

/** Which ward's data each map's ward layers hold. */
const holding = new WeakMap<MapLibreMap, string>()

export interface RevealTiming {
  /** From the start of the flight to the first lot. */
  rippleDelayMs: number
  rippleMs: number
  /** The dots drop over this window once the ripple has covered the ward. */
  dotsWindowMs: number
  dropMs: number
}

export function revealDurationMs(t: RevealTiming): number {
  return t.rippleDelayMs + t.rippleMs + t.dotsWindowMs + t.dropMs
}

function setPaint(map: MapLibreMap, layer: string, property: string, value: Paint): void {
  if (map.getLayer(layer)) map.setPaintProperty(layer, property as PaintName, value)
}

function firstPoint(geometry: Geometry): [number, number] | null {
  let coords: unknown = (geometry as { coordinates?: unknown }).coordinates
  while (Array.isArray(coords) && Array.isArray(coords[0])) coords = coords[0]
  return Array.isArray(coords) && typeof coords[0] === 'number' ? [coords[0], coords[1] as number] : null
}

/** Feature ids in order of distance from the origin, with those distances in metres. */
function byDistance(features: Feature<Geometry, unknown>[], origin: { lon: number; lat: number }) {
  const cosLat = Math.cos((origin.lat * Math.PI) / 180)
  const items: { id: number; d: number }[] = []
  for (const f of features) {
    const p = firstPoint(f.geometry)
    if (p === null || typeof f.id !== 'number') continue
    const dx = (p[0] - origin.lon) * cosLat * METRES_PER_DEGREE_LON
    const dy = (p[1] - origin.lat) * METRES_PER_DEGREE_LAT
    items.push({ id: f.id, d: Math.hypot(dx, dy) })
  }
  return items.sort((a, b) => a.d - b.d)
}

/** The ward's multiplex permits since May 2023: the dots the ward map shows (its permitFilter). */
function wardPermits(data: WardData): Feature<Point, PermitFeatureProps>[] {
  const ward = data.ward.ward_id
  return data.permits.features.filter(
    (f) => f.properties.w === ward && f.properties.k === 'multiplex' && f.properties.d >= engineConfig.permits_since,
  )
}

/** The ward map's layers, with each lot and dot hidden until its feature state switches it on. */
function addWardLayers(map: MapLibreMap, data: WardData, searchedLotId: string | null): void {
  addLayers(map, data, 'all', searchedLotId)
  const on: ExpressionSpecification = ['boolean', ['feature-state', 'on'], false]
  const shown = (layer: string, property: string) => {
    const own = map.getPaintProperty(layer, property as PaintName)
    setPaint(map, layer, property, ['case', on, typeof own === 'number' ? own : 1, 0])
  }
  shown('lots-fill', 'fill-opacity')
  shown('lots-stripes', 'fill-opacity')
  shown('lots-outline', 'line-opacity')

  // A dot's state `d`: 0 hidden, 1 dropping in (larger, lighter), 2 landed.
  const d: ExpressionSpecification = ['number', ['feature-state', 'd'], 0]
  const scale: ExpressionSpecification = ['match', d, 1, DOT_DROP_SCALE, 2, 1, 0]
  const radius = map.getPaintProperty(DOTS_LAYER, 'circle-radius')
  // The ward map's radius is ['interpolate', ['linear'], ['zoom'], z1, r1, z2, r2]: scale each stop.
  if (Array.isArray(radius) && radius[0] === 'interpolate') {
    const scaled = radius.map((v, i) => (i >= 3 && i % 2 === 0 && typeof v === 'number' ? ['*', v, scale] : v))
    setPaint(map, DOTS_LAYER, 'circle-radius', scaled as ExpressionSpecification)
  }
  const opacity: ExpressionSpecification = ['match', d, 1, DOT_DROP_OPACITY, 2, 1, 0]
  setPaint(map, DOTS_LAYER, 'circle-opacity', opacity)
  setPaint(map, DOTS_LAYER, 'circle-stroke-opacity', opacity)
}

/** Puts this ward's layers on the map, every lot and dot hidden, shown or not. */
function holdWard(map: MapLibreMap, data: WardData, searchedLotId: string | null, visible: boolean): void {
  if (!map.getSource(LOTS)) addWardLayers(map, data, searchedLotId)
  else if (holding.get(map) !== data.ward.ward_id) applyData(map, data)
  holding.set(map, data.ward.ward_id)
  applyDesign(map, 'all')
  applySearched(map, searchedLotId)
  map.removeFeatureState({ source: LOTS })
  map.removeFeatureState({ source: PERMITS })
  for (const layer of ALL_LAYERS) map.setLayoutProperty(layer, 'visibility', visible ? 'visible' : 'none')
}

/**
 * Hands the ward's lots to the map while nothing is moving (during the address check), hidden, so
 * "See your ward" does not have to copy them to MapLibre's worker as the flight starts.
 */
export function preloadWardLayers(map: MapLibreMap, data: WardData): void {
  if (holding.get(map) === data.ward.ward_id) return
  holdWard(map, data, null, false)
}

/** Every lot and dot hidden, the searched lot outlined, ready for `playReveal`. */
export function prepareWardLayers(map: MapLibreMap, data: WardData, searchedLotId: string | null): void {
  holdWard(map, data, searchedLotId, true)
  for (const [layer, opacity] of SEARCHED_OPACITY) {
    setPaint(map, layer, 'line-opacity-transition', { duration: 0, delay: 0 })
    setPaint(map, layer, 'line-opacity', opacity)
  }
}

/**
 * The ripple, then the dots, timed from now. Calls `onDone` when the last dot has landed, with
 * every lot and dot showing; the returned function stops it early.
 */
export function playReveal(
  map: MapLibreMap,
  data: WardData,
  origin: { lon: number; lat: number },
  timing: RevealTiming,
  onDone: () => void,
): () => void {
  const lots = byDistance(data.lots.features, origin)
  const dots = byDistance(wardPermits(data), origin)
  const farthest = Math.max(RIPPLE_START_M * 2, lots.at(-1)?.d ?? 0)
  const dotsStart = timing.rippleDelayMs + timing.rippleMs
  const dotAt = (i: number) => dotsStart + (dots.length > 1 ? (i / (dots.length - 1)) * timing.dotsWindowMs : 0)
  const end = revealDurationMs(timing)
  let lotNext = 0
  let dotNext = 0
  let landNext = 0
  let frame = 0
  const start = performance.now()

  const tick = (now: number) => {
    const t = now - start
    const u = Math.min(1, Math.max(0, (t - timing.rippleDelayMs) / timing.rippleMs))
    // Grows exponentially, as the view does while the camera pulls out.
    const front = t < timing.rippleDelayMs ? -1 : u >= 1 ? Infinity : RIPPLE_START_M * (farthest / RIPPLE_START_M) ** u
    while (lotNext < lots.length && lots[lotNext].d <= front) {
      map.setFeatureState({ source: LOTS, id: lots[lotNext].id }, { on: true })
      lotNext++
    }
    while (dotNext < dots.length && (dotAt(dotNext) <= t || t >= end)) {
      map.setFeatureState({ source: PERMITS, id: dots[dotNext].id }, { d: 1 })
      dotNext++
    }
    while (landNext < dotNext && (dotAt(landNext) + timing.dropMs <= t || t >= end)) {
      map.setFeatureState({ source: PERMITS, id: dots[landNext].id }, { d: 2 })
      landNext++
    }
    if (t >= end) {
      onDone()
      return
    }
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(frame)
}

/** Shows the whole ward at once (reduced motion). */
export function showWardLayers(map: MapLibreMap, data: WardData, searchedLotId: string | null): void {
  prepareWardLayers(map, data, searchedLotId)
  for (const f of data.lots.features) if (typeof f.id === 'number') map.setFeatureState({ source: LOTS, id: f.id }, { on: true })
  for (const f of wardPermits(data)) if (typeof f.id === 'number') map.setFeatureState({ source: PERMITS, id: f.id }, { d: 2 })
}

/**
 * On the way back to the lot: the dots go at once, the lots go from the edge of the ward inward
 * over `durationMs` as the camera comes down, and the outline fades. The returned function stops it.
 */
export function playHide(map: MapLibreMap, data: WardData, origin: { lon: number; lat: number }, durationMs: number): () => void {
  map.removeFeatureState({ source: PERMITS })
  for (const [layer] of SEARCHED_OPACITY) {
    setPaint(map, layer, 'line-opacity-transition', { duration: durationMs, delay: 0 })
    setPaint(map, layer, 'line-opacity', 0)
  }
  const lots = byDistance(data.lots.features, origin).reverse()
  let next = 0
  let frame = 0
  const start = performance.now()
  const tick = (now: number) => {
    const share = durationMs > 0 ? Math.min(1, (now - start) / durationMs) : 1
    const until = Math.ceil(share * lots.length)
    while (next < until) {
      map.setFeatureState({ source: LOTS, id: lots[next].id }, { on: false })
      next++
    }
    if (share < 1) frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(frame)
}

/** Back at a lot, or anywhere else: the ward's layers hidden, nothing switched on. */
export function hideWardLayers(map: MapLibreMap): void {
  if (!map.getSource(LOTS)) return
  map.removeFeatureState({ source: LOTS })
  map.removeFeatureState({ source: PERMITS })
  for (const layer of ALL_LAYERS) if (map.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', 'none')
}
