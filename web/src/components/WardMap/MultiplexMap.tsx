import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LngLatBounds,
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  type ExpressionSpecification,
  type GeoJSONSource,
  type MapGeoJSONFeature,
} from 'maplibre-gl'
import { fill } from '../../copy'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { tokenHex } from '../../styles/tokens'
import { blankStyle, neutraliseBase } from './layers'
import { MultiplexFilterPanel } from './MultiplexFilterPanel'
import { MultiplexLegend } from './MultiplexLegend'
import { MultiplexSearch, type PickedPlace } from './MultiplexSearch'
import { NearbyMultiplexes } from './NearbyMultiplexes'
import { mxCopy } from './multiplex/copy'
import { useMultiplexData } from './multiplex/data'
import { applyFilters, wardCounts } from './multiplex/filters'
import { circlePolygon, DEFAULT_RADIUS_M } from './multiplex/nearby'
import { popupContent } from './multiplex/popup'
import { rampClasses, type RampClass } from './multiplex/ramp'
import { mxSearchCopy } from './multiplex/searchCopy'
import { DEFAULT_FILTERS, type MultiplexCollection, type MultiplexFilters, type MultiplexProps, type WardCount, type WardShapeCollection } from './multiplex/types'
import './mapSetup'
import './multiplex.css'

// The permitted-multiplexes map: ward shading by count under the current filters, and the permits
// as clustered dots. A cleared permit is a solid dot, an active one a ring with a surface-coloured centre, so
// the two never differ by colour alone. Dots are placed near the permit's street, never at an address.

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'
/** The hosted style can hang when Wi-Fi is dead; after this the map falls back to a plain ground. */
const STYLE_TIMEOUT_MS = 3500
const MIN_ZOOM = 10
/**
 * Privacy cap. Points are only about 1 m precise, so a closer view would let a reader work out
 * which house a dot sits beside. Every zoom (map, fitBounds, cluster expansion) stops here.
 */
const MAX_ZOOM = 16
const TORONTO: [number, number] = [-79.38, 43.7]
const FIT_PADDING_PX = 40
const EASE_MS = 500
/** Permits closer than this many pixels join a cluster, until this zoom. */
const CLUSTER_RADIUS_PX = 40
const CLUSTER_MAX_ZOOM = 14
/** Cluster bubble radius by count: [base, then (count, radius) steps]. */
const CLUSTER_RADIUS: [number, number, number, number, number] = [14, 10, 18, 50, 24]
const CLUSTER_TEXT_PX = 12
/** The font OpenFreeMap's style serves glyphs for. */
const CLUSTER_FONT = ['Noto Sans Bold']
/** Dot radius at the lowest and highest zoom, and the ring's surface-coloured centre as a share of it. */
const DOT_RADIUS: [zoomA: number, radiusA: number, zoomB: number, radiusB: number] = [10, 4, MAX_ZOOM, 8]
const DOT_EDGE_PX = 1.5
const HOLE_SHARE = 0.45
/** Pixels around the pointer that count as hitting a dot; fingers are less exact than a mouse. */
const HIT_SLOP_MOUSE_PX = 5
const HIT_SLOP_TOUCH_PX = 12
const WARD_LINE_OPACITY = 0.35
const WARD_LINE_PX = 0.8
const WARD_HOVER_PX = 2.5
/** A fill that draws nothing but still answers hover and click. */
const HIT_ONLY = 'rgba(255, 255, 255, 0.01)'
/** The search circle: a light accent fill, a dashed outline, and a pin (a ring round a dot, no label). */
const NEAR_FILL_OPACITY = 0.1
const NEAR_LINE_PX = 2
const NEAR_DASH: number[] = [2, 2]
const NEAR_PIN_RADIUS_PX = 6
const NEAR_PIN_EDGE_PX = 3
/** Room the fitted circle leaves for the cards: wide screens keep the right side, phones the top and bottom. */
const NARROW_PX = 640
const WIDE_PX = 900
const FIT_SIDE_CARD_PX = 380
const FIT_TOP_PHONE_PX = 200
const FIT_BOTTOM_PHONE_SHARE = 0.5
/** Never let padding take more than this share of an axis, or the circle cannot be fitted at all. */
const FIT_MAX_PAD_SHARE = 0.6
const FIT_EASE_MS = 900

const WARDS = 'mx-wards'
const PERMITS = 'mx-permits'
const WARD_FILL = 'mx-ward-fill'
const WARD_LINE = 'mx-ward-line'
const WARD_HOVER = 'mx-ward-hover'
const CLUSTERS = 'mx-clusters'
const CLUSTER_COUNT = 'mx-cluster-count'
const DOT_EDGE = 'mx-dot-edge'
const DOT = 'mx-dot'
const DOT_HOLE = 'mx-dot-hole'
const NEAR = 'mx-near'
const NEAR_FILL = 'mx-near-fill'
const NEAR_LINE = 'mx-near-line'
const NEAR_PIN_RING = 'mx-near-pin-ring'
const NEAR_PIN = 'mx-near-pin'
const PERMIT_LAYERS = [CLUSTERS, CLUSTER_COUNT, DOT_EDGE, DOT, DOT_HOLE]
const CLICKABLE = [CLUSTERS, DOT_EDGE]

interface Tip {
  x: number
  y: number
  text: string
}

interface Props {
  /** A ward was clicked (not a dot or a cluster); `ward` is "01".."25". */
  onSelectWard?: (ward: string) => void
  /** Open the near-me view on this point (the dev harness reads it from ?near=lon,lat). */
  initialNear?: { lon: number; lat: number }
}

type Near = { lon: number; lat: number }

const EMPTY_NEAR: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

/** The circle and its centre pin as one collection. */
function nearCollection(near: Near): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      circlePolygon(near, DEFAULT_RADIUS_M),
      { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [near.lon, near.lat] } },
    ],
  }
}

/** Adds the search circle and pin under the permit dots, or hands the existing source the new circle. */
function showNear(map: MapLibreMap, near: Near | null): void {
  const data = near ? nearCollection(near) : EMPTY_NEAR
  const source = map.getSource(NEAR) as GeoJSONSource | undefined
  if (source) {
    source.setData(data)
    return
  }
  if (!near) return
  const accent = tokenHex('--suplex-accent')
  const surface = tokenHex('--suplex-surface')
  const polygon: ExpressionSpecification = ['==', ['geometry-type'], 'Polygon']
  const point: ExpressionSpecification = ['==', ['geometry-type'], 'Point']
  const beforePermits = map.getLayer(CLUSTERS) ? CLUSTERS : undefined
  map.addSource(NEAR, { type: 'geojson', data })
  map.addLayer({ id: NEAR_FILL, type: 'fill', source: NEAR, filter: polygon, paint: { 'fill-color': accent, 'fill-opacity': NEAR_FILL_OPACITY } }, beforePermits)
  map.addLayer(
    { id: NEAR_LINE, type: 'line', source: NEAR, filter: polygon, paint: { 'line-color': accent, 'line-width': NEAR_LINE_PX, 'line-dasharray': NEAR_DASH } },
    beforePermits,
  )
  // The pin sits above the dots: an accent ring round a surface centre, so it never reads as a permit.
  map.addLayer({
    id: NEAR_PIN_RING,
    type: 'circle',
    source: NEAR,
    filter: point,
    paint: { 'circle-color': accent, 'circle-radius': NEAR_PIN_RADIUS_PX + NEAR_PIN_EDGE_PX },
  })
  map.addLayer({ id: NEAR_PIN, type: 'circle', source: NEAR, filter: point, paint: { 'circle-color': surface, 'circle-radius': NEAR_PIN_RADIUS_PX } })
}

/** Padding that keeps the circle clear of the cards, clamped so the fit always has room. */
function fitPadding(map: MapLibreMap): { top: number; right: number; bottom: number; left: number } {
  const { clientWidth: w, clientHeight: h } = map.getContainer()
  let pad = { top: FIT_PADDING_PX, right: FIT_PADDING_PX, bottom: FIT_PADDING_PX, left: FIT_PADDING_PX }
  if (w <= NARROW_PX) pad = { ...pad, top: FIT_TOP_PHONE_PX, bottom: Math.round(h * FIT_BOTTOM_PHONE_SHARE) }
  else if (w >= WIDE_PX) pad = { ...pad, right: FIT_SIDE_CARD_PX }
  const fitAxis = (a: number, b: number, size: number): [number, number] => {
    const limit = size * FIT_MAX_PAD_SHARE
    const total = a + b
    return total <= limit ? [a, b] : [(a * limit) / total, (b * limit) / total]
  }
  const [top, bottom] = fitAxis(pad.top, pad.bottom, h)
  const [left, right] = fitAxis(pad.left, pad.right, w)
  return { top, right, bottom, left }
}

/** The card for the chosen place. Memoised so the map's hover re-renders never touch it. */
const NearCard = memo(function NearCard({ near, onClose }: { near: Near; onClose: () => void }) {
  return (
    <aside className="mx-near-card" aria-label={mxSearchCopy.aria.card}>
      <div className="mx-near-card-head">
        <button type="button" className="mx-near-close" onClick={onClose}>
          {mxSearchCopy.card.close}
        </button>
      </div>
      <div className="mx-near-card-body">
        <NearbyMultiplexes key={`${near.lon},${near.lat}`} centre={near} />
      </div>
    </aside>
  )
})

function rgbOf(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim())
  if (!m) throw new Error(`design token colour "${hex}" is not a 6-digit hex value`)
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
}

/** Base-map layers that draw house numbers or addresses. Dots must never sit beside one. */
const ADDRESS_LAYER = /house.?number|address/i
const ADDRESS_SOURCE_LAYER = /^(housenumber|address)/i

/**
 * Hides every base-map layer that labels house numbers or addresses. The current OpenFreeMap
 * positron style has none, so this is a guard against a style update that adds them.
 */
function hideAddressLabels(map: MapLibreMap): void {
  for (const layer of map.getStyle().layers) {
    const sourceLayer = (layer as { 'source-layer'?: string })['source-layer'] ?? ''
    if (!ADDRESS_LAYER.test(layer.id) && !ADDRESS_SOURCE_LAYER.test(sourceLayer)) continue
    if (map.getLayer(layer.id)) map.setLayoutProperty(layer.id, 'visibility', 'none')
  }
}

/** Ward shading: the accent colour at five rising opacities; a ward with none draws nothing. */
function wardFill(classes: RampClass[]): ExpressionSpecification | string {
  if (classes.length === 0) return HIT_ONLY
  const [r, g, b] = rgbOf(tokenHex('--suplex-accent'))
  const rgba = (alpha: number) => `rgba(${r}, ${g}, ${b}, ${alpha})`
  const stops = classes.flatMap((c) => [c.from, rgba(c.alpha)])
  return ['step', ['get', 'count'], HIT_ONLY, ...stops] as ExpressionSpecification
}

/** The ward shapes with the count and units of the permits that pass the filters. */
function shapesWithCounts(wards: WardShapeCollection, counts: Record<string, WardCount>): WardShapeCollection {
  return {
    ...wards,
    features: wards.features.map((f) => ({
      ...f,
      properties: { ...f.properties, count: counts[f.properties.ward]?.permits ?? 0, units: counts[f.properties.ward]?.units ?? 0 },
    })),
  }
}

function boundsOf(permits: MultiplexCollection): LngLatBounds | null {
  if (permits.features.length === 0) return null
  const bounds = new LngLatBounds()
  for (const f of permits.features) bounds.extend(f.geometry.coordinates as [number, number])
  return bounds
}

function addLayers(map: MapLibreMap, shapes: WardShapeCollection, permits: MultiplexCollection, classes: RampClass[], visible: boolean): void {
  // The ward shading goes under the base map's labels so street names stay readable.
  const firstLabel = map.getStyle().layers.find((l) => l.type === 'symbol')?.id
  const ink = tokenHex('--suplex-ink')
  const accent = tokenHex('--suplex-accent')
  const permit = tokenHex('--suplex-permit')
  const outline = tokenHex('--suplex-permit-outline')
  const surface = tokenHex('--suplex-surface')

  map.addSource(WARDS, { type: 'geojson', data: shapes })
  map.addSource(PERMITS, { type: 'geojson', data: permits, cluster: true, clusterMaxZoom: CLUSTER_MAX_ZOOM, clusterRadius: CLUSTER_RADIUS_PX })

  map.addLayer({ id: WARD_FILL, type: 'fill', source: WARDS, paint: { 'fill-color': wardFill(classes) } }, firstLabel)
  map.addLayer({ id: WARD_LINE, type: 'line', source: WARDS, paint: { 'line-color': ink, 'line-opacity': WARD_LINE_OPACITY, 'line-width': WARD_LINE_PX } }, firstLabel)
  map.addLayer(
    { id: WARD_HOVER, type: 'line', source: WARDS, filter: ['==', ['get', 'ward'], ''], paint: { 'line-color': accent, 'line-width': WARD_HOVER_PX } },
    firstLabel,
  )

  const visibility = visible ? 'visible' : 'none'
  const [zoomA, radiusA, zoomB, radiusB] = DOT_RADIUS
  const unclustered: ExpressionSpecification = ['!', ['has', 'point_count']]
  const [base, countA, radiusUp, countB, radiusTop] = CLUSTER_RADIUS

  map.addLayer({
    id: CLUSTERS,
    type: 'circle',
    source: PERMITS,
    filter: ['has', 'point_count'],
    layout: { visibility },
    paint: {
      'circle-color': permit,
      'circle-radius': ['step', ['get', 'point_count'], base, countA, radiusUp, countB, radiusTop],
      'circle-stroke-color': outline,
      'circle-stroke-width': DOT_EDGE_PX,
    },
  })
  // Count labels need glyphs; the plain fallback style has none, and the bubble size still says "more".
  if (map.getStyle().glyphs) {
    map.addLayer({
      id: CLUSTER_COUNT,
      type: 'symbol',
      source: PERMITS,
      filter: ['has', 'point_count'],
      layout: { visibility, 'text-field': ['get', 'point_count_abbreviated'], 'text-font': CLUSTER_FONT, 'text-size': CLUSTER_TEXT_PX, 'text-allow-overlap': true },
      paint: { 'text-color': outline },
    })
  }
  const radius = (share: number): ExpressionSpecification => ['interpolate', ['linear'], ['zoom'], zoomA, radiusA * share, zoomB, radiusB * share]
  map.addLayer({
    id: DOT_EDGE,
    type: 'circle',
    source: PERMITS,
    filter: unclustered,
    layout: { visibility },
    paint: { 'circle-color': outline, 'circle-radius': ['interpolate', ['linear'], ['zoom'], zoomA, radiusA + DOT_EDGE_PX, zoomB, radiusB + DOT_EDGE_PX] },
  })
  map.addLayer({ id: DOT, type: 'circle', source: PERMITS, filter: unclustered, layout: { visibility }, paint: { 'circle-color': permit, 'circle-radius': radius(1) } })
  map.addLayer({
    id: DOT_HOLE,
    type: 'circle',
    source: PERMITS,
    filter: ['all', unclustered, ['==', ['get', 'status'], 'active']],
    layout: { visibility },
    paint: { 'circle-color': surface, 'circle-radius': radius(HOLE_SHARE) },
  })
}

/** The popup's body: the street only, the facts and the note. Built with textContent, never HTML. */
function popupBody(props: MultiplexProps): HTMLElement {
  const content = popupContent(props)
  const body = document.createElement('div')
  body.className = 'mx-popup-body'
  body.setAttribute('role', 'group')
  body.setAttribute('aria-label', mxCopy.aria.popup)
  const heading = document.createElement('h3')
  heading.className = 'mx-popup-heading'
  heading.textContent = content.heading
  const list = document.createElement('dl')
  list.className = 'mx-popup-rows'
  for (const row of content.rows) {
    const line = document.createElement('div')
    const term = document.createElement('dt')
    term.textContent = row.label
    const value = document.createElement('dd')
    value.textContent = row.value
    line.append(term, value)
    list.append(line)
  }
  const note = document.createElement('p')
  note.className = 'mx-popup-note'
  note.textContent = content.note
  body.append(heading, list, note)
  return body
}

export function MultiplexMap({ onSelectWard, initialNear }: Props) {
  const load = useMultiplexData()
  const data = load.status === 'ready' ? load.data : null
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const popupRef = useRef<Popup | null>(null)
  const fitted = useRef(false)
  /** True from a style's load until the style is swapped; false while no style is usable. */
  const styleReady = useRef(false)
  /** Counts up on every style load, so the layers are added again if the style is swapped. */
  const [styleTick, setStyleTick] = useState(0)
  const [tip, setTip] = useState<Tip | null>(null)
  const [filters, setFilters] = useState<MultiplexFilters>(DEFAULT_FILTERS)
  const [showPermits, setShowPermits] = useState(true)
  const [near, setNear] = useState<Near | null>(initialNear ?? null)
  const [cardOpen, setCardOpen] = useState(true)
  const reduced = useReducedMotion()

  const filtered = useMemo(() => (data ? applyFilters(data.permits, filters) : null), [data, filters])
  const counts = useMemo(() => (data ? wardCounts(data.permits, filters) : null), [data, filters])
  const shapes = useMemo(() => (data && counts ? shapesWithCounts(data.wards, counts) : null), [data, counts])
  const classes = useMemo(() => rampClasses(counts ? Object.values(counts).map((c) => c.permits) : []), [counts])

  // The map's event handlers are made once; they read the latest props from here.
  const live = useRef({ onSelectWard, reduced, showPermits, near })
  useEffect(() => {
    live.current = { onSelectWard, reduced, showPermits, near }
  })

  const onPick = useCallback((place: PickedPlace) => {
    setNear({ lon: place.lon, lat: place.lat })
    setCardOpen(true)
  }, [])
  const onClear = useCallback(() => setNear(null), [])
  const onCloseCard = useCallback(() => setCardOpen(false), [])

  useEffect(() => {
    const el = container.current
    if (!el) return
    const map = new MapLibreMap({
      container: el,
      style: STYLE_URL,
      center: TORONTO,
      zoom: MIN_ZOOM,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: { compact: true },
    })
    map.touchZoomRotate.disableRotation()
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')

    let fellBack = false
    const fallBackToBlank = () => {
      if (fellBack || styleReady.current) return
      fellBack = true
      // diff:false replaces the style outright, so style.load always fires and the layers are re-added.
      map.setStyle(blankStyle(), { diff: false })
    }
    const timer = window.setTimeout(fallBackToBlank, STYLE_TIMEOUT_MS)
    // One failed tile is ordinary; only an error before the style itself has loaded means a dead style.
    map.on('error', (e) => {
      if ((e as { tile?: unknown }).tile) return
      fallBackToBlank()
    })

    // Also runs after the fallback style replaces the hosted one.
    map.on('style.load', () => {
      window.clearTimeout(timer)
      styleReady.current = true
      neutraliseBase(map)
      hideAddressLabels(map)
      setStyleTick((t) => t + 1)
    })

    const closePopup = () => {
      popupRef.current?.remove()
      popupRef.current = null
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !popupRef.current) return
      closePopup()
      map.getCanvas().focus()
    }
    document.addEventListener('keydown', onKey)

    const hitSlop = window.matchMedia('(pointer: coarse)').matches ? HIT_SLOP_TOUCH_PX : HIT_SLOP_MOUSE_PX
    const dotsAt = (point: { x: number; y: number }): MapGeoJSONFeature[] => {
      const layers = CLICKABLE.filter((id) => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none')
      if (layers.length === 0) return []
      const box: [[number, number], [number, number]] = [
        [point.x - hitSlop, point.y - hitSlop],
        [point.x + hitSlop, point.y + hitSlop],
      ]
      return map.queryRenderedFeatures(box, { layers })
    }
    const wardAt = (point: { x: number; y: number }): MapGeoJSONFeature | undefined =>
      map.getLayer(WARD_FILL) ? map.queryRenderedFeatures([point.x, point.y], { layers: [WARD_FILL] })[0] : undefined
    const setHoverWard = (ward: string) => {
      if (map.getLayer(WARD_HOVER)) map.setFilter(WARD_HOVER, ['==', ['get', 'ward'], ward])
    }

    map.on('mousemove', (e) => {
      if (dotsAt(e.point).length > 0) {
        map.getCanvas().style.cursor = 'pointer'
        setHoverWard('')
        setTip(null)
        return
      }
      const ward = wardAt(e.point)
      if (!ward) {
        map.getCanvas().style.cursor = ''
        setHoverWard('')
        setTip(null)
        return
      }
      const p = ward.properties as { ward: string; name: string; count: number; units: number }
      map.getCanvas().style.cursor = live.current.onSelectWard ? 'pointer' : ''
      setHoverWard(p.ward)
      setTip({
        x: e.point.x,
        y: e.point.y,
        text: fill(p.count === 1 ? mxCopy.ward.tooltip_one : mxCopy.ward.tooltip, { ward: Number(p.ward), name: p.name, count: p.count, units: p.units }),
      })
    })
    map.getCanvas().addEventListener('mouseleave', () => {
      setHoverWard('')
      setTip(null)
    })

    map.on('click', (e) => {
      const hit = dotsAt(e.point)[0]
      if (hit) {
        if (hit.layer.id === CLUSTERS) {
          const clusterId = (hit.properties as { cluster_id: number }).cluster_id
          const source = map.getSource(PERMITS) as GeoJSONSource | undefined
          const centre = (hit.geometry as GeoJSON.Point).coordinates as [number, number]
          void source
            ?.getClusterExpansionZoom(clusterId)
            .then((zoom) => {
              map.easeTo({ center: centre, zoom: Math.min(zoom, MAX_ZOOM), duration: live.current.reduced ? 0 : EASE_MS })
            })
            .catch(() => {})
          return
        }
        closePopup()
        const coordinates = (hit.geometry as GeoJSON.Point).coordinates as [number, number]
        const popup = new Popup({ closeButton: true, maxWidth: '280px', className: 'mx-popup', focusAfterOpen: true, offset: DOT_RADIUS[3] + DOT_EDGE_PX })
          .setLngLat(coordinates)
          .setDOMContent(popupBody(hit.properties as unknown as MultiplexProps))
          .addTo(map)
        popup.on('close', () => {
          if (popupRef.current === popup) popupRef.current = null
        })
        popupRef.current = popup
        return
      }
      const ward = wardAt(e.point)
      if (ward && live.current.onSelectWard) live.current.onSelectWard((ward.properties as { ward: string }).ward)
    })

    mapRef.current = map
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', onKey)
      closePopup()
      mapRef.current = null
      fitted.current = false
      map.remove()
    }
  }, [])

  // Data, filters or a swapped style: add the layers, or hand the sources the new data (the clusters
  // recompute on their own).
  useEffect(() => {
    const map = mapRef.current
    if (!map || styleTick === 0 || !styleReady.current || !data || !shapes || !filtered) return
    if (!map.getSource(WARDS)) {
      addLayers(map, shapes, filtered, classes, live.current.showPermits)
    } else {
      ;(map.getSource(WARDS) as GeoJSONSource).setData(shapes)
      ;(map.getSource(PERMITS) as GeoJSONSource).setData(filtered)
      map.setPaintProperty(WARD_FILL, 'fill-color', wardFill(classes))
    }
    popupRef.current?.remove()
    popupRef.current = null
    if (!fitted.current) {
      // A near-me view that was asked for already owns the camera; the all-Toronto fit would undo it.
      const bounds = live.current.near ? null : boundsOf(data.permits)
      if (bounds) map.fitBounds(bounds, { padding: FIT_PADDING_PX, duration: 0, maxZoom: MAX_ZOOM })
      fitted.current = true
    }
  }, [data, shapes, filtered, classes, styleTick])

  // The search circle and pin: added after the permit layers so they sit under the dots, and added
  // again after a style swap. Cleared, the source is emptied.
  useEffect(() => {
    const map = mapRef.current
    if (!map || styleTick === 0 || !styleReady.current) return
    // While the permit data is still loading its layers do not exist yet, and the circle must go under them.
    if (near && load.status === 'loading') return
    showNear(map, near)
  }, [near, styleTick, data, load.status])

  // Move the camera to the circle when a place is chosen (not on later data or filter changes).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !near) return
    const ring = (circlePolygon(near, DEFAULT_RADIUS_M).geometry.coordinates[0] ?? []) as [number, number][]
    const bounds = new LngLatBounds()
    for (const c of ring) bounds.extend(c)
    map.fitBounds(bounds, { padding: fitPadding(map), maxZoom: MAX_ZOOM, duration: live.current.reduced ? 0 : FIT_EASE_MS, essential: true })
    // Only the chosen point matters here, not the object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near?.lon, near?.lat])

  // The layer toggle.
  useEffect(() => {
    const map = mapRef.current
    if (!map || styleTick === 0 || !map.getSource(PERMITS)) return
    for (const id of PERMIT_LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', showPermits ? 'visible' : 'none')
    if (!showPermits) {
      popupRef.current?.remove()
      popupRef.current = null
    }
  }, [showPermits, styleTick, data])

  return (
    <div className="mx-map" aria-busy={load.status === 'loading'} data-near-open={near !== null && cardOpen}>
      <div className="mx-map-canvas" ref={container} role="region" aria-label={mxCopy.aria.map}>
        {tip && (
          <div className="mx-tooltip" style={{ left: tip.x, top: tip.y }}>
            {tip.text}
          </div>
        )}
      </div>
      {load.status === 'error' && (
        <p className="mx-error" role="alert">
          {load.message}
        </p>
      )}
      <div className="mx-top">
        <MultiplexSearch onPick={onPick} onClear={onClear} active={near !== null} />
        {near && !cardOpen && (
          <button type="button" className="mx-near-reopen" onClick={() => setCardOpen(true)}>
            {mxSearchCopy.card.reopen}
          </button>
        )}
        {data && filtered && counts && (
          <MultiplexFilterPanel
            filters={filters}
            onChange={setFilters}
            shown={filtered.features.length}
            total={data.permits.features.length}
            showPermits={showPermits}
            onShowPermits={setShowPermits}
          />
        )}
      </div>
      {near && cardOpen && <NearCard near={near} onClose={onCloseCard} />}
      {data && filtered && counts && (
        <>
          <MultiplexLegend wards={data.wards} counts={counts} classes={classes} fetchedAt={data.meta.fetchedAt} />
        </>
      )}
    </div>
  )
}
