import { useCallback, useEffect, useMemo, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import type { CheckResponse, DesignResult } from '@contracts/types'
import { fill, labels } from '../../copy'
import { useApp } from '../../state/store'
import { planCopy } from './copy'
import { PlanBackdrop } from './PlanBackdrop'
import { centre, niceLength, permitRadius, ringPath, viewBoxFor, type Preset, type ViewBox } from './geometry'
import { useSize, useViewBox } from './useBox'

// Sizes are in screen pixels and turned into metres with `px`, so marks keep their size as the
// view zooms from a 30 m lot to a 1 km neighbourhood.
const PERMIT_HALF_PX = 9
const LOT_STROKE_PX = 2.5
const LINE_PX = 1.25
const PIN_PX = 10
const TREE_MIN_RADIUS_PX = 3
const TREE_RADIUS_M = 1.8
const HATCH_PX = 6
const FAIL_MARK_PX = 22
const RING_LABEL_PX = 12
const SCALE_BAR_TARGET_PX = 110
const SHADOW_PX = 3
const HALO_PX = 12

// Zoom limits, in metres per screen pixel: about 30 m across a 1000 px stage at the closest, and
// about 1.8 km at the furthest.
const MIN_M_PER_PX = 0.03
const MAX_M_PER_PX = 1.8
const WHEEL_ZOOM_RATE = 0.0015
const PINCH_ZOOM_RATE = 0.01
const BUTTON_ZOOM_STEP = 0.6
const KEY_PAN_FRACTION = 0.15
/** The view's centre can wander this far (as a share of the permit radius) from the lot. */
const PAN_LIMIT = 1

// Marks that only make sense at some zoom levels, by how many metres the stage spans.
const TREES_MAX_SPAN_M = 250
const PIN_MIN_SPAN_M = 200

interface Props {
  check: CheckResponse
  design: DesignResult | null
  /** A new object on every press of a zoom preset, so pressing the same one again re-fits the view. */
  preset: Preset
  /** The wheel, a drag or a zoom button moved the view, so no preset describes it any more. */
  onManual: () => void
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** The lot, the design on it, the buildings around it and the multiplex permits nearby, seen from above. */
export function PlanMap({ check, design, preset, onManual }: Props) {
  const stage = useRef<HTMLDivElement>(null)
  const graphics = useApp((s) => s.graphics)
  const size = useSize(stage)
  const target = useMemo(() => viewBoxFor(preset.scale, check), [preset, check])
  const [box, setBox] = useViewBox(target)
  // Metres per screen pixel: the SVG fits its viewBox inside the stage (meet).
  const px = size.w > 0 && size.h > 0 ? Math.max(box.w / size.w, box.h / size.h) : box.w / 800
  const span = px * (size.w || 800)
  const radius = permitRadius(check)

  // The wheel, pointer and keyboard handlers read the latest view through this.
  const live = useRef({ box, px })
  useEffect(() => {
    live.current = { box, px }
  })

  const moveTo = useCallback(
    (next: ViewBox) => {
      const limit = radius * PAN_LIMIT
      const cx = clamp(next.x + next.w / 2, -limit, limit)
      const cy = clamp(next.y + next.h / 2, -limit, limit)
      setBox({ x: cx - next.w / 2, y: cy - next.h / 2, w: next.w, h: next.h })
      onManual()
    },
    [radius, setBox, onManual],
  )

  /** Zooms by `factor` (below 1 zooms in), keeping the point at (clientX, clientY) under the cursor. */
  const zoomAt = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      const el = stage.current
      if (!el) return
      const { box: b, px: p } = live.current
      const f = clamp(factor, MIN_M_PER_PX / p, MAX_M_PER_PX / p)
      const rect = el.getBoundingClientRect()
      const cx = b.x + b.w / 2
      const cy = b.y + b.h / 2
      const wx = cx + (clientX - rect.left - rect.width / 2) * p
      const wy = cy + (clientY - rect.top - rect.height / 2) * p
      const w = b.w * f
      const h = b.h * f
      moveTo({ x: wx - (wx - cx) * f - w / 2, y: wy - (wy - cy) * f - h / 2, w, h })
    },
    [moveTo],
  )

  const zoomBy = useCallback(
    (factor: number) => {
      const rect = stage.current?.getBoundingClientRect()
      if (rect) zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor)
    },
    [zoomAt],
  )

  // React's onWheel is passive and cannot stop the page zooming on a trackpad pinch.
  useEffect(() => {
    const el = stage.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rate = event.ctrlKey ? PINCH_ZOOM_RATE : WHEEL_ZOOM_RATE
      zoomAt(event.clientX, event.clientY, Math.exp(event.deltaY * rate))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  const drag = useRef<{ x: number; y: number } | null>(null)
  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return
    drag.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.dataset.dragging = 'true'
  }
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const from = drag.current
    if (!from) return
    const { box: b, px: p } = live.current
    drag.current = { x: event.clientX, y: event.clientY }
    moveTo({ ...b, x: b.x - (event.clientX - from.x) * p, y: b.y - (event.clientY - from.y) * p })
  }
  const endDrag = (event: PointerEvent<SVGSVGElement>) => {
    drag.current = null
    delete event.currentTarget.dataset.dragging
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const { box: b } = live.current
    const pan = (dx: number, dy: number) => moveTo({ ...b, x: b.x + dx * b.w * KEY_PAN_FRACTION, y: b.y + dy * b.h * KEY_PAN_FRACTION })
    const actions: Record<string, () => void> = {
      '+': () => zoomBy(BUTTON_ZOOM_STEP),
      '=': () => zoomBy(BUTTON_ZOOM_STEP),
      '-': () => zoomBy(1 / BUTTON_ZOOM_STEP),
      ArrowLeft: () => pan(-1, 0),
      ArrowRight: () => pan(1, 0),
      ArrowUp: () => pan(0, -1),
      ArrowDown: () => pan(0, 1),
    }
    const action = actions[event.key]
    if (!action) return
    event.preventDefault()
    action()
  }

  const { context, lot, permits_nearby: permits } = check
  const offLot = context.buildings.filter((b) => !b.on_lot)
  const onLot = context.buildings.filter((b) => b.on_lot)
  const half = PERMIT_HALF_PX * px
  const barM = niceLength(SCALE_BAR_TARGET_PX * px)
  const hatch = HATCH_PX * px
  // Where the building data ends, and where the permits end.
  const rings = [...new Set([context.radius_m, radius])].sort((a, b) => a - b)
  const line = fill(permits.count === 1 ? labels.ui.permits_near_you_line_one : labels.ui.permits_near_you_line, {
    count: permits.count,
    radius_m: permits.radius_m,
  })

  return (
    <div className="plan-stage" ref={stage} tabIndex={0} role="group" aria-label={planCopy.aria_plan} onKeyDown={onKeyDown}>
      {/* The street map behind the plan needs WebGL; without it the plan stands on its own. */}
      {graphics && <PlanBackdrop origin={context.origin} box={box} mPerPx={px} />}
      <svg
        className="plan-svg"
        viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
        role="img"
        aria-label={line}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <defs>
          <filter id="plan-lot-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx={0} dy={SHADOW_PX * px * 0.6} stdDeviation={SHADOW_PX * px} floodColor="#14240a" floodOpacity={0.35} />
          </filter>
          <pattern id="plan-hatch-yard" width={hatch} height={hatch} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line className="plan-hatch-yard" x1={0} y1={0} x2={0} y2={hatch} strokeWidth={LINE_PX * px} />
          </pattern>
          <pattern id="plan-hatch-fail" width={hatch} height={hatch} patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <line className="plan-hatch-fail" x1={0} y1={0} x2={0} y2={hatch} strokeWidth={LINE_PX * 1.6 * px} />
          </pattern>
        </defs>

        {rings.map((r) => (
          <g key={r}>
            <circle className="plan-ring" cx={0} cy={0} r={r} strokeWidth={LINE_PX * px} strokeDasharray={`${4 * px} ${5 * px}`} />
            <text className="plan-ring-label" x={0} y={-r - 5 * px} fontSize={RING_LABEL_PX * px} textAnchor="middle">
              {r} {labels.units.m}
            </text>
          </g>
        ))}

        {offLot.map((b, i) => (
          <path
            key={`${b.building_id}-${i}`}
            className={`plan-building plan-building-${b.kind}`}
            d={ringPath(b.footprint_local)}
            strokeWidth={LINE_PX * px}
          />
        ))}

        {span <= TREES_MAX_SPAN_M &&
          context.trees.map(([x, y], i) => (
            <circle key={i} className="plan-tree" cx={x} cy={-y} r={Math.max(TREE_RADIUS_M, TREE_MIN_RADIUS_PX * px)} />
          ))}

        <path className="plan-lot-halo" d={ringPath(lot.polygon_local)} strokeWidth={HALO_PX * px} />
        <path className="plan-lot" d={ringPath(lot.polygon_local)} strokeWidth={LOT_STROKE_PX * px} filter="url(#plan-lot-shadow)" />

        {onLot.map((b, i) => (
          <path
            key={`${b.building_id}-${i}`}
            className="plan-existing"
            d={ringPath(b.footprint_local)}
            strokeWidth={LINE_PX * px}
            strokeDasharray={`${5 * px} ${3 * px}`}
          />
        ))}

        {design?.setbacks_local &&
          Object.entries(design.setbacks_local).map(([side, ring]) => (
            <path key={side} className="plan-yard" d={ringPath(ring)} />
          ))}
        {design?.buildable_local && (
          <path className="plan-buildable" d={ringPath(design.buildable_local)} strokeWidth={LINE_PX * 1.4 * px} strokeDasharray={`${6 * px} ${4 * px}`} />
        )}
        {design?.placement_local && <path className="plan-home" d={ringPath(design.placement_local)} strokeWidth={LINE_PX * 1.6 * px} />}
        {design?.fail_slices_local.map((slice, i) => {
          const [x, y] = centre(slice)
          return (
            <g key={i}>
              <path className="plan-fail" d={ringPath(slice)} strokeWidth={LINE_PX * 1.6 * px} />
              <text className="plan-fail-mark" x={x} y={-y} fontSize={FAIL_MARK_PX * px} strokeWidth={3 * px} textAnchor="middle" dominantBaseline="central">
                ✕
              </text>
            </g>
          )
        })}

        {permits.points_local.map(([x, y], i) => (
          <path
            key={i}
            className="plan-permit"
            d={`M${x},${-y - half}L${x + half},${-y}L${x},${-y + half}L${x - half},${-y}Z`}
            strokeWidth={LINE_PX * px}
          />
        ))}

        {span >= PIN_MIN_SPAN_M && (
          <g className="plan-pin" strokeWidth={LOT_STROKE_PX * px}>
            <circle cx={0} cy={0} r={PIN_PX * px} />
            <circle className="plan-pin-dot" cx={0} cy={0} r={PIN_PX * 0.35 * px} />
          </g>
        )}
      </svg>

      <div className="plan-north" aria-hidden="true">
        <span>↑</span>
        <span>{planCopy.north}</span>
      </div>
      <div className="plan-scalebar" aria-hidden="true" style={{ width: barM / px }}>
        {barM} {labels.units.m}
      </div>
      <div className="plan-steps">
        <button type="button" className="plan-step" aria-label={planCopy.zoom_in} onClick={() => zoomBy(BUTTON_ZOOM_STEP)}>
          +
        </button>
        <button type="button" className="plan-step" aria-label={planCopy.zoom_out} onClick={() => zoomBy(1 / BUTTON_ZOOM_STEP)}>
          −
        </button>
      </div>
    </div>
  )
}
