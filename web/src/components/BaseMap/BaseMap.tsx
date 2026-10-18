import { useEffect, useRef } from 'react'
import { Map as MapLibreMap, MercatorCoordinate, setWorkerUrl, type PaddingOptions } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { CheckResponse, DesignId } from '@contracts/types'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { PANEL_WIDTH_PX } from '../../layout'
import { useApp } from '../../state/store'
import { cameraBridge, type BridgedPose } from '../Lot3D/cameraBridge'
import { lotFraming } from '../Lot3D/framing'
import { FOV_DEG, HANDOFF_S, MAP_FADE_S, REST_TILT_DEG } from '../Lot3D/view'
import type { Bounds } from '../WardMap/data'
import { distanceForZoom, zoomForDistance } from './handoff'
import { applyPalette, fadeBuildings, setWardBase } from './mapStyle'
import {
  hideWardLayers,
  playHide,
  playReveal,
  preloadWardLayers,
  prepareWardLayers,
  showWardLayers,
  type RevealTiming,
} from './wardTransition'

// One map behind the whole app. On the landing page it is a slowly swaying 3D Toronto. A search
// flies it, in one move, to the lot's rest view: the 3D camera's own pose (tilt, heading toward the
// lot from the street, distance, field of view, the lot centred beside the panel). Over the last
// stretch the 3D scene fades in with its camera locked to this one and the map's buildings fade
// away, so the street rises in their place while the camera is still descending, and the flight's
// ease-out is the end of a single move.
// "See your ward" (MASTERSPEC 6.6) pulls the same map out from the lot to the whole ward, the lots
// rippling in and the permit dots dropping, and the ward map takes over on the view it ends on;
// "Back to your lot" flies it back down, the 3D scene fading in over the last stretch again.

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
/** Lot to ward (MASTERSPEC 6.6): the flight out, and the ripple and the dots timed from its start. */
const WARD_FLY_MS = 2000
const REVEAL: RevealTiming = { rippleDelayMs: 300, rippleMs: 1500, dotsWindowMs: 300, dropMs: 150 }
/** The ground eases to the ward map's neutral colours over the first part of the flight out. */
const WARD_BASE_MS = 1200
/** Ward to lot: under 2 s (J6); the 3D scene fades in over the last HANDOFF_S of it. */
const BACK_FLY_MS = 1500
/** On the way back the lots go from the ward's edge inward over this share of the flight. */
const BACK_HIDE_SHARE = 0.7
/** How the ward map frames its ward (WardMap/WardMapCanvas.tsx FIT_PADDING_PX, beside its panel). */
const WARD_FIT_PADDING_PX = 40
const WARD_PADDING: Required<PaddingOptions> = {
  top: WARD_FIT_PADDING_PX,
  bottom: WARD_FIT_PADDING_PX,
  left: WARD_FIT_PADDING_PX,
  right: PANEL_WIDTH_PX + WARD_FIT_PADDING_PX,
}
/** MapLibre's world is 512 px wide at zoom 0. */
const WORLD_PX_AT_ZOOM_0 = 512
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

/**
 * The view the ward map's `fitBounds` gives its ward, flat and north up, worked out the same way
 * (MapLibre's cameraForBounds on a map with no padding of its own), so this map can fly to it
 * while it still has the lot view's tilt, heading and padding.
 */
function wardView(map: MapLibreMap, bounds: Bounds) {
  const { clientWidth: width, clientHeight: height } = map.getContainer()
  const sw = MercatorCoordinate.fromLngLat(bounds[0])
  const ne = MercatorCoordinate.fromLngLat(bounds[1])
  const p = WARD_PADDING
  const worldPx = Math.min((width - p.left - p.right) / (ne.x - sw.x), (height - p.top - p.bottom) / (sw.y - ne.y))
  const zoom = Math.min(Math.log2(worldPx / WORLD_PX_AT_ZOOM_0), map.getMaxZoom())
  const world = WORLD_PX_AT_ZOOM_0 * 2 ** zoom
  const x = (sw.x + ne.x) / 2 - (p.left - p.right) / 2 / world
  const y = (sw.y + ne.y) / 2 - (p.top - p.bottom) / 2 / world
  return { center: new MercatorCoordinate(x, y).toLngLat(), zoom, bearing: 0, pitch: 0, padding: NO_PADDING }
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
  const wardData = useApp((s) => s.wardData)
  const wardStatus = useApp((s) => s.wardStatus)
  const arriveWard = useApp((s) => s.arriveWard)
  /** The ward's layers and colours are on this map (from "See your ward" until back at a lot). */
  const onWard = useRef(false)

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

  // Landing: come back out to the city if we were down at a lot, its buildings filling back in, then sway.
  useEffect(() => {
    const map = mapRef.current
    if (!map || view !== 'landing') return
    fadeBuildings(map, true, RETURN_MS / 2)
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
  // scene fades in, its camera reading this map's camera through the bridge, while the map's
  // buildings fade out for the 3D street; on landing it takes over.
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
    const handoff = window.setTimeout(() => {
      beginHandoff()
      fadeBuildings(map, false, MAP_FADE_S * 1000)
    }, FLY_MS - HANDOFF_S * 1000)
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

  // While the address check rests, hand the ward's lots to this map too (hidden), in its own idle
  // moment after the ward map's, so the flight out starts without copying them.
  useEffect(() => {
    const map = mapRef.current
    if (!map || view !== 'lot' || !ready.current || !wardData || wardData.ward.ward_id !== check?.lot.ward_id) return
    const idle = 'requestIdleCallback' in window
    const handle = idle ? window.requestIdleCallback(() => preloadWardLayers(map, wardData), { timeout: 3000 }) : 0
    if (!idle) preloadWardLayers(map, wardData)
    return () => {
      if (idle) window.cancelIdleCallback(handle)
    }
  }, [view, check, wardData])

  // "See your ward": once the ward data is in (it usually is, loaded during the check), fly out to
  // the ward, rippling the lots in from this lot and dropping the dots, then hand over to the ward map.
  useEffect(() => {
    const map = mapRef.current
    if (!map || view !== 'toWard') return
    if (wardStatus === 'loading' || wardStatus === 'idle') return
    const data = wardData?.ward.ward_id === check?.lot.ward_id ? wardData : null
    if (!ready.current || !check || !data) {
      arriveWard()
      return
    }
    onWard.current = true
    setWardBase(map, true, reduced ? 0 : WARD_BASE_MS)
    if (reduced) {
      showWardLayers(map, data, check.lot.lot_id)
      map.jumpTo(wardView(map, data.bounds))
      arriveWard()
      return
    }
    prepareWardLayers(map, data, check.lot.lot_id)
    map.flyTo({ ...wardView(map, data.bounds), duration: WARD_FLY_MS })
    return playReveal(map, data, check.context.origin, REVEAL, arriveWard)
  }, [view, check, wardData, wardStatus, reduced, arriveWard])

  // "Back to your lot": fly back down to the lot's rest view as the ward fades; over the last
  // stretch the 3D scene, its street still built, fades in with its camera on this one's.
  useEffect(() => {
    const map = mapRef.current
    if (!map || view !== 'toLot') return
    if (!ready.current || !check) {
      land()
      return
    }
    const origin = check.context.origin
    const duration = reduced ? 0 : BACK_FLY_MS
    setWardBase(map, false, duration)
    const { wardData: data } = useApp.getState()
    const stopHide = onWard.current && data ? playHide(map, data, origin, duration * BACK_HIDE_SHARE) : () => {}
    const landed = () => {
      cameraBridge.read = null
      hideWardLayers(map)
      onWard.current = false
      land()
    }
    map.once('moveend', landed)
    map.flyTo({ ...restView(map, check, useApp.getState().designId), duration })
    const handoff = window.setTimeout(
      () => {
        cameraBridge.read = () => bridgedPose(map, origin)
        useApp.getState().beginHandoff()
      },
      Math.max(0, duration - HANDOFF_S * 1000),
    )
    return () => {
      window.clearTimeout(handoff)
      stopHide()
      map.off('moveend', landed)
      cameraBridge.read = null
    }
  }, [view, check, reduced, land])

  // Anywhere else (a lot clicked on the ward map, a new search, the landing page): the ward's layers
  // and colours go at once.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !onWard.current || view === 'toWard' || view === 'ward' || view === 'toLot') return
    onWard.current = false
    hideWardLayers(map)
    setWardBase(map, false, 0)
  }, [view])

  return <div ref={container} className="basemap" aria-hidden="true" />
}
