import { useEffect, useRef } from 'react'
import { Map as MapLibreMap, setWorkerUrl, type PaddingOptions } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { PANEL_WIDTH_PX } from '../../layout'
import { useApp } from '../../state/store'
import { handoffZoom } from './handoff'
import { applyPalette } from './mapStyle'

// One map behind the whole app. On the landing page it is a slowly swaying 3D Toronto; a search
// flies it down to the address, and the flight ends on the 3D scene's opening view (looking
// straight down, north up, the lot centred beside the panel) so the scene can fade in over it.
// The ward map (J5) and the lot-to-ward transition (J6) will reuse it.

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'
/**
 * Downtown from over the harbour, turned to Toronto's street grid. The centre sits south of the
 * core so the towers stand above the landing card rather than behind it.
 */
const HERO = { center: [-79.3815, 43.6335] as [number, number], zoom: 14.2, pitch: 60, bearing: -17 }
/** The landing view sways slowly either side of the grid instead of turning away from downtown. */
const SWAY_DEG = 18
const SWAY_PERIOD_S = 70
const FLY_MS = 2800
/**
 * The flight never pulls back past this zoom. Further out the tiles thin out and buildings pop in
 * and out of the picture while it moves.
 */
const FLY_MIN_ZOOM = 14
/**
 * At most this many tile zoom levels on screen at once (MapLibre's default is about 9). Distant
 * tiles at low zoom carry few or no buildings, and the edge where they stop slides about as the
 * camera moves.
 */
const TILE_ZOOM_LEVELS_ON_SCREEN = 3
const TILE_COUNT_MAX_MIN_RATIO = 3
/** The flight aims at the address point; this short ease lands on the lot centroid the scene uses. */
const SETTLE_MS = 500
const RETURN_MS = 2000
// MapLibre looks for its worker next to its own file, which Vite moves. Hand it the worker as Vite
// builds workers (a plain ?url import gets Vite's dev client injected, which cannot run in a worker).
setWorkerUrl(workerUrl)

const NO_PADDING: PaddingOptions = { top: 0, right: 0, bottom: 0, left: 0 }
const BESIDE_PANEL: PaddingOptions = { ...NO_PADDING, right: PANEL_WIDTH_PX }

/** The handoff view over a point: what the 3D camera sees at the top of its swoop. */
function lotView(map: MapLibreMap, [lon, lat]: [number, number]) {
  const zoom = handoffZoom(lat, map.getContainer().clientHeight)
  return { center: [lon, lat] as [number, number], zoom, pitch: 0, bearing: 0, padding: BESIDE_PANEL }
}

export function BaseMap() {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  /** False until the style loads (not every tile); offline it never does, and flights are skipped. */
  const ready = useRef(false)
  const reduced = useReducedMotion()

  const view = useApp((s) => s.view)
  const flight = useApp((s) => s.flight)
  const check = useApp((s) => s.check)
  const checkStatus = useApp((s) => s.checkStatus)
  const arrive = useApp((s) => s.arrive)
  const land = useApp((s) => s.land)

  useEffect(() => {
    if (!container.current) return
    const map = new MapLibreMap({
      container: container.current,
      style: STYLE_URL,
      ...HERO,
      interactive: false,
      attributionControl: { compact: true },
    })
    // style.load, not load: load waits for every tile in view, and a quick click would skip the
    // flight. Recolouring here also means the grey stock style never shows.
    map.once('style.load', () => {
      applyPalette(map)
      map.setSourceTileLodParams(TILE_ZOOM_LEVELS_ON_SCREEN, TILE_COUNT_MAX_MIN_RATIO)
      ready.current = true
    })
    mapRef.current = map
    return () => {
      ready.current = false
      mapRef.current = null
      map.remove()
    }
  }, [])

  // Landing: come back out to the city if we were down at a lot, then sway.
  useEffect(() => {
    const map = mapRef.current
    if (!map || view !== 'landing') return
    if (map.getPitch() < HERO.pitch - 1) map.flyTo({ ...HERO, padding: NO_PADDING, duration: RETURN_MS })
    if (reduced) return
    let frame = 0
    let last = performance.now()
    // Only time spent swaying counts, so the sway picks up from HERO.bearing after the flight back.
    let swayed = 0
    const tick = (now: number) => {
      if (ready.current && !map.isMoving()) {
        swayed += (now - last) / 1000
        map.setBearing(HERO.bearing + SWAY_DEG * Math.sin((2 * Math.PI * swayed) / SWAY_PERIOD_S))
      }
      last = now
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [view, reduced])

  // Flying, part one: down to the address point while the check loads.
  useEffect(() => {
    const map = mapRef.current
    if (!map || view !== 'flying' || !flight || flight.arrived) return
    if (!ready.current) {
      arrive()
      return
    }
    // Listen first: with reduced motion MapLibre jumps and fires moveend straight away.
    map.once('moveend', arrive)
    map.flyTo({ ...lotView(map, flight.to), duration: FLY_MS, minZoom: FLY_MIN_ZOOM })
    return () => {
      map.off('moveend', arrive)
    }
  }, [view, flight, arrive])

  // Flying, part two: once the check is in, settle on the lot centroid and hand over.
  useEffect(() => {
    const map = mapRef.current
    if (!map || view !== 'flying' || !flight?.arrived || checkStatus === 'loading') return
    if (checkStatus !== 'ready' || !check || !ready.current) {
      land()
      return
    }
    const { lon, lat } = check.context.origin
    map.once('moveend', land)
    map.easeTo({ ...lotView(map, [lon, lat]), duration: SETTLE_MS })
    return () => {
      map.off('moveend', land)
    }
  }, [view, flight, check, checkStatus, land])

  // In the address check, keep the map under the lot (deep links and new searches jump straight there).
  useEffect(() => {
    const map = mapRef.current
    if (!map || view !== 'lot' || !check) return
    const { lon, lat } = check.context.origin
    map.jumpTo(lotView(map, [lon, lat]))
  }, [view, check])

  return <div ref={container} className="basemap" aria-hidden="true" />
}
