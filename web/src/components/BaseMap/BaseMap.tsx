import { useEffect, useRef } from 'react'
import { Map as MapLibreMap, setWorkerUrl, type PaddingOptions } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { CheckResponse, DesignId } from '@contracts/types'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { PANEL_WIDTH_PX } from '../../layout'
import { useApp } from '../../state/store'
import { lotFraming } from '../Lot3D/framing'
import { FOV_DEG, REST_TILT_DEG } from '../Lot3D/view'
import { zoomForDistance } from './handoff'
import { applyPalette } from './mapStyle'

// One map behind the whole app. On the landing page it is a slowly swaying 3D Toronto. A search
// flies it, in one move, to the lot's rest view: the 3D camera's own pose (tilt, heading toward the
// lot from the street, distance, field of view, the lot centred beside the panel). The 3D scene
// then fades in over it from that same camera, so the flight is the whole swoop.
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
/** The flight carries the descent, the turn to the street side and the tilt, so it takes its time. */
const FLY_MS = 3400
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
const RETURN_MS = 2000
// MapLibre looks for its worker next to its own file, which Vite moves. Hand it the worker as Vite
// builds workers (a plain ?url import gets Vite's dev client injected, which cannot run in a worker).
setWorkerUrl(workerUrl)

const NO_PADDING: PaddingOptions = { top: 0, right: 0, bottom: 0, left: 0 }
const BESIDE_PANEL: PaddingOptions = { ...NO_PADDING, right: PANEL_WIDTH_PX }

/** The lot's rest view as a map camera: exactly where the 3D camera starts. */
function restView(map: MapLibreMap, check: CheckResponse, designId: DesignId | null) {
  const { lon, lat } = check.context.origin
  const { distanceM, viewBearingDeg } = lotFraming(check, designId)
  return {
    center: [lon, lat] as [number, number],
    zoom: zoomForDistance(lat, map.getContainer().clientHeight, distanceM),
    pitch: 90 - REST_TILT_DEG,
    bearing: viewBearingDeg,
    padding: BESIDE_PANEL,
  }
}

export function BaseMap() {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  /** False until the style loads (not every tile); offline it never does, and flights are skipped. */
  const ready = useRef(false)
  const reduced = useReducedMotion()

  const view = useApp((s) => s.view)
  const check = useApp((s) => s.check)
  const checkStatus = useApp((s) => s.checkStatus)
  const designId = useApp((s) => s.designId)
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
    // The 3D camera's field of view, so the two cameras see the same picture at the handoff.
    map.setVerticalFieldOfView(FOV_DEG)
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

  // Flying: once the check is in, one flight to the lot's rest view, then hand over.
  useEffect(() => {
    const map = mapRef.current
    if (!map || view !== 'flying' || checkStatus === 'loading') return
    if (checkStatus !== 'ready' || !check || !ready.current) {
      land()
      return
    }
    // Listen first: with reduced motion MapLibre jumps and fires moveend straight away.
    map.once('moveend', land)
    // The design is the one set with the check; read it here so a tab change never restarts the flight.
    const { designId: firstDesign } = useApp.getState()
    map.flyTo({ ...restView(map, check, firstDesign), duration: FLY_MS, minZoom: FLY_MIN_ZOOM })
    return () => {
      map.off('moveend', land)
    }
  }, [view, check, checkStatus, land])

  // In the address check, keep the map under the lot (deep links and new searches jump straight there).
  useEffect(() => {
    const map = mapRef.current
    if (!map || view !== 'lot' || !check) return
    map.jumpTo(restView(map, check, designId))
  }, [view, check, designId])

  return <div ref={container} className="basemap" aria-hidden="true" />
}
