import { useEffect, useRef, useState } from 'react'
import { Map as MapLibreMap, type MapGeoJSONFeature, type MapMouseEvent } from 'maplibre-gl'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { PANEL_WIDTH_PX } from '../../layout'
import { applyData, applyDesign, applySearched, addLayers, blankStyle, neutraliseBase } from './layers'
import type { DesignFilter } from './designs'
import type { LotProps, WardData } from './data'
import { tooltipText } from './tooltip'
import './mapSetup'

// MapLibre with OpenFreeMap's neutral positron style, not the green landing-page style, so the lot
// colours read (MASTERSPEC 6.5). Zoom is limited to 11 to 18.

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'
/** The hosted style can hang when Wi-Fi is dead; after this the map falls back to a plain ground. */
const STYLE_TIMEOUT_MS = 3500
const MIN_ZOOM = 11
const MAX_ZOOM = 18
const FIT_PADDING_PX = 40
const PULSE_PERIOD_MS = 2000
const PULSE_MIN = 0.35

interface Tip {
  x: number
  y: number
  text: string
}

interface Props {
  data: WardData
  filter: DesignFilter
  searchedLotId: string | null
  onSelectLot: (lotId: string) => void
  ariaLabel: string
}

export function WardMapCanvas({ data, filter, searchedLotId, onSelectLot, ariaLabel }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const [ready, setReady] = useState(false)
  const [tip, setTip] = useState<Tip | null>(null)
  const reduced = useReducedMotion()

  // The map's event handlers are made once; they read the latest props from here.
  const live = useRef({ data, filter, searchedLotId, onSelectLot })
  useEffect(() => {
    live.current = { data, filter, searchedLotId, onSelectLot }
  })

  useEffect(() => {
    const el = container.current
    if (!el) return
    const map = new MapLibreMap({
      container: el,
      style: STYLE_URL,
      center: [-79.38, 43.7],
      zoom: MIN_ZOOM,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: { compact: true },
    })
    map.touchZoomRotate.disableRotation()

    let fellBack = false
    const useBlankStyle = () => {
      if (fellBack || map.isStyleLoaded()) return
      fellBack = true
      map.setStyle(blankStyle())
    }
    const timer = window.setTimeout(useBlankStyle, STYLE_TIMEOUT_MS)
    map.on('error', useBlankStyle)

    // Also runs after the fallback style replaces the hosted one.
    map.on('style.load', () => {
      window.clearTimeout(timer)
      const { data: d, filter: f, searchedLotId: s } = live.current
      neutraliseBase(map)
      addLayers(map, d, f, s)
      map.fitBounds(d.bounds, { padding: { top: FIT_PADDING_PX, left: FIT_PADDING_PX, bottom: FIT_PADDING_PX, right: PANEL_WIDTH_PX + FIT_PADDING_PX }, duration: 0 })
      setReady(true)
    })

    const lotAt = (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => e.features?.[0]
    map.on('mousemove', 'lots-fill', (e) => {
      const feature = lotAt(e)
      if (!feature) return
      map.getCanvas().style.cursor = 'pointer'
      setTip({ x: e.point.x, y: e.point.y, text: tooltipText(feature.properties as unknown as LotProps, live.current.filter) })
    })
    map.on('mouseleave', 'lots-fill', () => {
      map.getCanvas().style.cursor = ''
      setTip(null)
    })
    map.on('click', 'lots-fill', (e) => {
      const feature = lotAt(e)
      if (feature) live.current.onSelectLot(String((feature.properties as { id: number }).id))
    })

    mapRef.current = map
    return () => {
      window.clearTimeout(timer)
      mapRef.current = null
      setReady(false)
      map.remove()
    }
  }, [])

  // A different ward: new data, and the view fits it.
  const shownWard = useRef(data.ward.ward_id)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || shownWard.current === data.ward.ward_id) return
    shownWard.current = data.ward.ward_id
    applyData(map, data)
    map.fitBounds(data.bounds, { padding: { top: FIT_PADDING_PX, left: FIT_PADDING_PX, bottom: FIT_PADDING_PX, right: PANEL_WIDTH_PX + FIT_PADDING_PX }, duration: 0 })
  }, [data, ready])

  useEffect(() => {
    const map = mapRef.current
    if (map && ready) applyDesign(map, filter)
  }, [filter, ready])

  useEffect(() => {
    const map = mapRef.current
    if (map && ready) applySearched(map, searchedLotId)
  }, [searchedLotId, ready])

  // The searched lot's white outline pulses gently (a 2 s cycle); with reduced motion it holds still.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || reduced || searchedLotId === null) return
    let frame = 0
    const tick = (now: number) => {
      const wave = (1 + Math.sin((2 * Math.PI * now) / PULSE_PERIOD_MS)) / 2
      if (map.getLayer('searched')) map.setPaintProperty('searched', 'line-opacity', PULSE_MIN + (1 - PULSE_MIN) * wave)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      if (map.getLayer('searched')) map.setPaintProperty('searched', 'line-opacity', 1)
    }
  }, [ready, reduced, searchedLotId])

  return (
    <div className="ward-map-canvas" ref={container} role="img" aria-label={ariaLabel}>
      {tip && (
        <div className="ward-tooltip" style={{ left: tip.x, top: tip.y }}>
          {tip.text}
        </div>
      )}
    </div>
  )
}
