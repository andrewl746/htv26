import { useEffect, useRef } from 'react'
import { Map as MapLibreMap, MercatorCoordinate, setWorkerUrl, type PaddingOptions } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { CheckResponse, DesignId } from '@contracts/types'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { PANEL_WIDTH_PX } from '../../layout'
import { useApp } from '../../state/store'
import { cameraBridge, type BridgedPose } from '../Lot3D/cameraBridge'
import { lotFraming } from '../Lot3D/framing'
import { FOV_DEG, HANDOFF_S, REST_TILT_DEG } from '../Lot3D/view'
import { distanceForZoom, zoomForDistance } from './handoff'
import { applyPalette } from './mapStyle'

// One map behind the whole app. On the landing page it is a slowly swaying 3D Toronto. A search
// flies it, in one move, to the lot's rest view: the 3D camera's own pose (tilt, heading toward the
// lot from the street, distance, field of view, the lot centred beside the panel). Over the last
// stretch the 3D scene fades in with its camera locked to this one, so the street rises while the
// camera is still descending, and the flight's ease-out is the end of a single move.
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
 * One tile zoom level across the whole view (MapLibre's default allows about 9). Lower-zoom tiles
 * in the distance merge buildings into blocks, so with a single level every building on screen is
 * a house of its own from the first frame. Measured at the landing view: 38 tiles, all zoom 14
 * (the default mix was 16 at zoom 14 and 9 at zoom 13).
 */
const TILE_ZOOM_LEVELS_ON_SCREEN = 1
const TILE_COUNT_MAX_MIN_RATIO = 4
const RETURN_MS = 2000
// MapLibre looks for its worker next to its own file, which Vite moves. Hand it the worker as Vite
// builds workers (a plain ?url import gets Vite's dev client injected, which cannot run in a worker).
setWorkerUrl(workerUrl)

const NO_PADDING: PaddingOptions = { top: 0, right: 0, bottom: 0, left: 0 }
const BESIDE_PANEL: PaddingOptions = { ...NO_PADDING, right: PANEL_WIDTH_PX }

/**
 * The map camera as a pose in the 3D scene's frame (metres from the lot centroid; x east, y up,
 * z south). MapLibre's camera stands `distanceForZoom` metres from the map centre, tilted back by
 * the pitch, on the side opposite the bearing it looks along.
 */
function bridgedPose(map: MapLibreMap, origin: { lon: number; lat: number }): BridgedPose {
  const o = MercatorCoordinate.fromLngLat([origin.lon, origin.lat])
  const unitsPerMetre = o.meterInMercatorCoordinateUnits()
  const centre = map.getCenter()
  const c = MercatorCoordinate.fromLngLat(centre)
  const east = (c.x - o.x) / unitsPerMetre
  const north = (o.y - c.y) / unitsPerMetre
  const distance = distanceForZoom(centre.lat, map.getContainer().clientHeight, map.getZoom())
  const pitch = (map.getPitch() * Math.PI) / 180
  const bearing = (map.getBearing() * Math.PI) / 180
  const cameraEast = east - distance * Math.sin(pitch) * Math.sin(bearing)
  const cameraNorth = north - distance * Math.sin(pitch) * Math.cos(bearing)
  return {
    position: [cameraEast, distance * Math.cos(pitch), -cameraNorth],
    target: [east, 0, -north],
  }
}

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

  // Flying: once the check is in, one flight to the lot's rest view. For its last HANDOFF_S the 3D
  // scene fades in, its camera reading this map's camera through the bridge; on landing it takes over.
  useEffect(() => {
    const map = mapRef.current
    if (!map || view !== 'flying' || checkStatus === 'loading') return
    if (checkStatus !== 'ready' || !check || !ready.current) {
      land()
      return
    }
    const origin = check.context.origin
    cameraBridge.read = () => bridgedPose(map, origin)
    const landed = () => {
      cameraBridge.read = null
      land()
    }
    // Listen first: with reduced motion MapLibre jumps and fires moveend straight away.
    map.once('moveend', landed)
    // The design is the one set with the check; read it here so a tab change never restarts the flight.
    const { designId: firstDesign, beginHandoff } = useApp.getState()
    map.flyTo({ ...restView(map, check, firstDesign), duration: FLY_MS, minZoom: FLY_MIN_ZOOM })
    const handoff = window.setTimeout(beginHandoff, FLY_MS - HANDOFF_S * 1000)
    return () => {
      window.clearTimeout(handoff)
      map.off('moveend', landed)
      cameraBridge.read = null
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
