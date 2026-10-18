import type { Feature, FeatureCollection, Polygon } from 'geojson'
import type { ExpressionSpecification, FilterSpecification, GeoJSONSource, Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'
import engineConfig from '@contracts/engine_config.json'
import { tokenHex } from '../../styles/tokens'
import { resultProp, type DesignFilter } from './designs'
import type { WardData } from './data'

// The ward map's layers (MASTERSPEC 6.5), all drawn from the data the batch writes. Colours come
// from the design tokens; the stripe pattern is drawn once on a 12 px canvas.

export const LOTS = 'lots'
export const PERMITS = 'permits'
const NEAR_RING = 'near-ring'
const STRIPES_IMAGE = 'borderline-stripes'

const STRIPE_TILE_PX = 12
const STRIPE_WIDTH_PX = 3
/**
 * Opaque: a see-through fill blends the "may fit" green into the ground and lowers its contrast
 * (measured 1.88:1 against a park at 0.8; the token's ceiling on the light ground is 2.38:1).
 */
const LOT_FILL_OPACITY = 1
/** The base map layers that carry a green tint; the ward map flattens them to the plain land colour. */
const GREEN_BASE_LAYERS = ['park', 'landcover_wood', 'landcover_grass']
const OUTLINE_FROM_ZOOM = 15
const PERMIT_RADIUS: [zoomA: number, radiusA: number, zoomB: number, radiusB: number] = [12, 6, 17, 10]
const PERMIT_STROKE_PX = 1.5
const SEARCHED_WIDTH_PX = 3
const SEARCHED_CASING_PX = 6
/** "Near your lot" circle: a thin dashed line over a paler casing so it reads on green and grey. */
const NEAR_RING_WIDTH_PX = 2
const NEAR_RING_CASING_PX = 4
const NEAR_RING_DASH: number[] = [3, 2]
const NEAR_RING_CASING_OPACITY = 0.8
/** A fill that draws nothing but still answers hover and click: "not checked" lots show no fill. */
const HIT_ONLY = 'rgba(255, 255, 255, 0.01)'

/** The neutral base for the ward map when the hosted style cannot be reached. */
export function blankStyle(): StyleSpecification {
  return { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': tokenHex('--suplex-surface') } }] }
}

function stripesImage(): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = STRIPE_TILE_PX
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d canvas for the stripe pattern')
  ctx.fillStyle = tokenHex('--suplex-borderline-base')
  ctx.fillRect(0, 0, STRIPE_TILE_PX, STRIPE_TILE_PX)
  ctx.strokeStyle = tokenHex('--suplex-borderline-stripe')
  ctx.lineWidth = STRIPE_WIDTH_PX
  // Three parallel diagonals, so the stripes run unbroken from tile to tile.
  for (const shift of [-STRIPE_TILE_PX, 0, STRIPE_TILE_PX]) {
    ctx.beginPath()
    ctx.moveTo(shift, STRIPE_TILE_PX)
    ctx.lineTo(shift + STRIPE_TILE_PX, 0)
    ctx.stroke()
  }
  return ctx.getImageData(0, 0, STRIPE_TILE_PX, STRIPE_TILE_PX)
}

function fillColour(prop: string): ExpressionSpecification {
  return [
    'match',
    ['get', prop],
    'fits',
    tokenHex('--suplex-fit'),
    'borderline',
    tokenHex('--suplex-borderline-base'),
    'no_fit',
    tokenHex('--suplex-nofit'),
    HIT_ONLY,
  ]
}

function permitFilter(wardId: string): FilterSpecification {
  return ['all', ['==', ['get', 'w'], wardId], ['==', ['get', 'k'], 'multiplex'], ['>=', ['get', 'd'], engineConfig.permits_since]]
}

function searchedFilter(lotId: string | null): FilterSpecification {
  const id = lotId === null ? NaN : Number(lotId)
  // No lot, or an id that is not a number, matches nothing.
  return Number.isFinite(id) ? ['==', ['get', 'id'], id] : ['==', ['get', 'id'], -1]
}

/**
 * Keeps green out of the base map (MASTERSPEC 6.5: the lot colours must read): parks and woods take
 * the land colour, so the only green on the ward map is "may fit". A blank fallback style has none.
 */
export function neutraliseBase(map: MapLibreMap): void {
  const land = map.getLayer('background') ? map.getPaintProperty('background', 'background-color') : undefined
  if (typeof land !== 'string') return
  for (const id of GREEN_BASE_LAYERS) if (map.getLayer(id)) map.setPaintProperty(id, 'fill-color', land)
}

/** Adds the sources and layers; safe to call again after the style is swapped. */
export function addLayers(map: MapLibreMap, data: WardData, filter: DesignFilter, searchedLotId: string | null): void {
  if (map.getSource(LOTS)) return
  const prop = resultProp(filter)
  if (!map.hasImage(STRIPES_IMAGE)) map.addImage(STRIPES_IMAGE, stripesImage(), { pixelRatio: 1 })

  map.addSource(LOTS, { type: 'geojson', data: data.lots })
  map.addSource(PERMITS, { type: 'geojson', data: data.permits })

  map.addLayer({ id: 'lots-fill', type: 'fill', source: LOTS, paint: { 'fill-color': fillColour(prop), 'fill-opacity': LOT_FILL_OPACITY } })
  map.addLayer({
    id: 'lots-stripes',
    type: 'fill',
    source: LOTS,
    filter: ['==', ['get', prop], 'borderline'],
    paint: { 'fill-pattern': STRIPES_IMAGE },
  })
  map.addLayer({
    id: 'lots-outline',
    type: 'line',
    source: LOTS,
    minzoom: OUTLINE_FROM_ZOOM,
    paint: { 'line-color': tokenHex('--suplex-ink'), 'line-opacity': 0.3, 'line-width': 0.6 },
  })
  map.addLayer({
    id: 'searched-casing',
    type: 'line',
    source: LOTS,
    filter: searchedFilter(searchedLotId),
    paint: { 'line-color': tokenHex('--suplex-ink'), 'line-width': SEARCHED_CASING_PX, 'line-opacity': 0.5 },
  })
  map.addLayer({
    id: 'searched',
    type: 'line',
    source: LOTS,
    filter: searchedFilter(searchedLotId),
    paint: { 'line-color': '#ffffff', 'line-width': SEARCHED_WIDTH_PX },
  })
  const [zoomA, radiusA, zoomB, radiusB] = PERMIT_RADIUS
  map.addLayer({
    id: 'permits-dots',
    type: 'circle',
    source: PERMITS,
    filter: permitFilter(data.ward.ward_id),
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], zoomA, radiusA, zoomB, radiusB],
      'circle-color': tokenHex('--suplex-permit'),
      'circle-stroke-color': tokenHex('--suplex-permit-outline'),
      'circle-stroke-width': PERMIT_STROKE_PX,
    },
  })
}

/** Recolours the lots for a design (or all four) without reloading anything. */
export function applyDesign(map: MapLibreMap, filter: DesignFilter): void {
  if (!map.getLayer('lots-fill')) return
  const prop = resultProp(filter)
  map.setPaintProperty('lots-fill', 'fill-color', fillColour(prop))
  map.setFilter('lots-stripes', ['==', ['get', prop], 'borderline'])
}

export function applySearched(map: MapLibreMap, lotId: string | null): void {
  if (!map.getLayer('searched')) return
  map.setFilter('searched', searchedFilter(lotId))
  map.setFilter('searched-casing', searchedFilter(lotId))
}

/** Swaps in a ward's data. */
export function applyData(map: MapLibreMap, data: WardData): void {
  const lots = map.getSource(LOTS) as GeoJSONSource | undefined
  const permits = map.getSource(PERMITS) as GeoJSONSource | undefined
  if (!lots || !permits) return
  lots.setData(data.lots)
  permits.setData(data.permits)
  map.setFilter('permits-dots', permitFilter(data.ward.ward_id))
}

/**
 * Draws (or moves, or removes) the "Near your lot" circle: a dashed line with no fill, above the
 * lots and below the permit dots, in no layer that answers hover or click. Safe to call at any time
 * after the style has loaded.
 */
export function applyNearRing(map: MapLibreMap, ring: Feature<Polygon> | null): void {
  const data: FeatureCollection<Polygon> = { type: 'FeatureCollection', features: ring ? [ring] : [] }
  const source = map.getSource(NEAR_RING) as GeoJSONSource | undefined
  if (source) {
    source.setData(data)
    return
  }
  if (!ring) return
  const before = map.getLayer('permits-dots') ? 'permits-dots' : undefined
  map.addSource(NEAR_RING, { type: 'geojson', data })
  map.addLayer(
    {
      id: 'near-ring-casing',
      type: 'line',
      source: NEAR_RING,
      paint: { 'line-color': tokenHex('--suplex-surface'), 'line-width': NEAR_RING_CASING_PX, 'line-opacity': NEAR_RING_CASING_OPACITY },
    },
    before,
  )
  map.addLayer(
    {
      id: 'near-ring',
      type: 'line',
      source: NEAR_RING,
      paint: { 'line-color': tokenHex('--suplex-accent'), 'line-width': NEAR_RING_WIDTH_PX, 'line-dasharray': NEAR_RING_DASH },
    },
    before,
  )
}
