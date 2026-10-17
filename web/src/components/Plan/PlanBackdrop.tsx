import { useEffect, useRef } from 'react'
import { Map as MapLibreMap, MercatorCoordinate } from 'maplibre-gl'
import { tokenHex } from '../../styles/tokens'
import { planCopy } from './copy'
import type { ViewBox } from './geometry'

// A flat street map under the plan: roads, street names, parks and water, so the footprints sit on
// a real street grid. It is its own small map, not the app's base map, which belongs to the landing
// flight and the 3D camera. It follows the plan's view box exactly and never takes input.

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'
const EARTH_CIRCUMFERENCE_M = 40075016.686
/** MapLibre's world is 512 px wide at zoom 0. */
const TILE_PX = 512
/** Layers drawn by the plan itself (buildings) or that only add clutter (shops, house numbers). */
const HIDDEN_SOURCE_LAYERS = ['building', 'poi', 'housenumber']

type PaintProperty = Parameters<MapLibreMap['setPaintProperty']>[1]

function tidyStyle(map: MapLibreMap): void {
  const land = tokenHex('--suplex-surface')
  const paint: [layer: string, property: PaintProperty, value: string][] = [
    ['background', 'background-color', land],
    ['landuse_residential', 'fill-color', land],
    ['park', 'fill-color', tokenHex('--palette-tea')],
    ['landcover_wood', 'fill-color', tokenHex('--palette-tea')],
    ['water', 'fill-color', tokenHex('--suplex-neighbour-2')],
    ['waterway', 'line-color', tokenHex('--suplex-neighbour-2')],
  ]
  for (const [layer, property, value] of paint) {
    if (map.getLayer(layer)) map.setPaintProperty(layer, property, value)
  }
  for (const layer of map.getStyle().layers) {
    const sourceLayer = (layer as { 'source-layer'?: string })['source-layer']
    if (sourceLayer && HIDDEN_SOURCE_LAYERS.includes(sourceLayer)) map.setLayoutProperty(layer.id, 'visibility', 'none')
  }
}

/** The map's centre and zoom for a plan view box, `mPerPx` metres to a screen pixel. */
function cameraFor(origin: { lon: number; lat: number }, box: ViewBox, mPerPx: number) {
  const o = MercatorCoordinate.fromLngLat([origin.lon, origin.lat])
  const unit = o.meterInMercatorCoordinateUnits()
  // The box is in SVG coordinates (y down); the local frame has y north.
  const east = box.x + box.w / 2
  const north = -(box.y + box.h / 2)
  const centre = new MercatorCoordinate(o.x + east * unit, o.y - north * unit, 0).toLngLat()
  const metresPerPxAtZoom0 = (EARTH_CIRCUMFERENCE_M * Math.cos((origin.lat * Math.PI) / 180)) / TILE_PX
  return { center: centre, zoom: Math.log2(metresPerPxAtZoom0 / mPerPx) }
}

export function PlanBackdrop({ origin, box, mPerPx }: { origin: { lon: number; lat: number }; box: ViewBox; mPerPx: number }) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const latest = useRef({ origin, box, mPerPx })

  useEffect(() => {
    latest.current = { origin, box, mPerPx }
    mapRef.current?.jumpTo({ ...cameraFor(origin, box, mPerPx), bearing: 0, pitch: 0 })
  }, [origin, box, mPerPx])

  useEffect(() => {
    if (!container.current) return
    const { origin: o, box: b, mPerPx: m } = latest.current
    const map = new MapLibreMap({
      container: container.current,
      style: STYLE_URL,
      ...cameraFor(o, b, m),
      bearing: 0,
      pitch: 0,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
    })
    map.once('style.load', () => tidyStyle(map))
    // Offline the tiles never arrive; the plan stays readable on its plain ground.
    map.on('error', () => {})
    mapRef.current = map
    return () => {
      mapRef.current = null
      map.remove()
    }
  }, [])

  return (
    <>
      <div ref={container} className="plan-backdrop" aria-hidden="true" />
      <p className="plan-attribution">{planCopy.attribution}</p>
    </>
  )
}
