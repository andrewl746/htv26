import { useMemo, useRef } from 'react'
import type { CheckResponse, DesignResult } from '@contracts/types'
import { fill, labels } from '../../copy'
import { planCopy } from './copy'
import { centre, niceLength, ringPath, viewBoxFor, type PlanScale } from './geometry'
import { useSize, useTweenedBox } from './useBox'

// Sizes are in screen pixels and turned into metres with `px`, so marks keep their size as the
// view zooms from a 30 m lot to a 1 km neighbourhood.
const PERMIT_HALF_PX = 7
const LOT_STROKE_PX = 2.5
const LINE_PX = 1.25
const PIN_PX = 10
const TREE_MIN_RADIUS_PX = 3
const TREE_RADIUS_M = 1.8
const TREES_MAX_SPAN_M = 250
const HATCH_PX = 6
const FAIL_MARK_PX = 22
const RING_LABEL_PX = 12
const SCALE_BAR_TARGET_PX = 110
const NEIGHBOUR_COLOURS = 5

interface Props {
  check: CheckResponse
  design: DesignResult | null
  scale: PlanScale
}

/** The lot, the design on it, the buildings around it and the multiplex permits nearby, seen from above. */
export function PlanMap({ check, design, scale }: Props) {
  const stage = useRef<HTMLDivElement>(null)
  const size = useSize(stage)
  const target = useMemo(() => viewBoxFor(scale, check, design), [scale, check, design])
  const box = useTweenedBox(target)
  // Metres per screen pixel: the SVG fits its viewBox inside the stage (meet).
  const px = size.w > 0 && size.h > 0 ? Math.max(box.w / size.w, box.h / size.h) : box.w / 800

  const { context, lot, permits_nearby: permits } = check
  const offLot = context.buildings.filter((b) => !b.on_lot)
  const onLot = context.buildings.filter((b) => b.on_lot)
  const showTrees = box.w <= TREES_MAX_SPAN_M
  const half = PERMIT_HALF_PX * px
  const barM = niceLength(SCALE_BAR_TARGET_PX * px)
  const hatch = HATCH_PX * px
  const radius = permits.radius_m || context.radius_m
  const line = fill(permits.count === 1 ? labels.ui.permits_near_you_line_one : labels.ui.permits_near_you_line, {
    count: permits.count,
    radius_m: permits.radius_m,
  })

  return (
    <div className="plan-stage" ref={stage}>
      <svg
        className="plan-svg"
        viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
        role="img"
        aria-label={`${planCopy.aria_plan}. ${line}`}
      >
        <defs>
          <pattern id="plan-hatch-yard" width={hatch} height={hatch} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line className="plan-hatch-yard" x1={0} y1={0} x2={0} y2={hatch} strokeWidth={LINE_PX * px} />
          </pattern>
          <pattern id="plan-hatch-fail" width={hatch} height={hatch} patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <line className="plan-hatch-fail" x1={0} y1={0} x2={0} y2={hatch} strokeWidth={LINE_PX * 1.6 * px} />
          </pattern>
        </defs>

        {[radius / 2, radius].map((r) => (
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
            className="plan-building"
            d={ringPath(b.footprint_local)}
            style={{ fill: `var(--suplex-neighbour-${(b.building_id % NEIGHBOUR_COLOURS) + 1})` }}
            strokeWidth={LINE_PX * px}
          />
        ))}

        {showTrees &&
          context.trees.map(([x, y], i) => (
            <circle key={i} className="plan-tree" cx={x} cy={-y} r={Math.max(TREE_RADIUS_M, TREE_MIN_RADIUS_PX * px)} />
          ))}

        <path className="plan-lot" d={ringPath(lot.polygon_local)} strokeWidth={LOT_STROKE_PX * px} />

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

        {scale === 'neighbourhood' && (
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
    </div>
  )
}
