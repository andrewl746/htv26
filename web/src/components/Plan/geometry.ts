import type { CheckResponse, DesignResult, LocalPoint } from '@contracts/types'

// The plan is drawn in the contract's local metres (x east, y north, from the lot centroid).
// SVG's y runs down, so every point is flipped once, here.

export interface ViewBox {
  x: number
  y: number
  w: number
  h: number
}

export type PlanScale = 'lot' | 'neighbourhood'

export const svgPoint = ([x, y]: LocalPoint): string => `${x},${-y}`

export const ringPath = (ring: LocalPoint[]): string => `M${ring.map(svgPoint).join('L')}Z`

/** Vertex average: enough to seat a mark inside a slice. */
export function centre(ring: LocalPoint[]): LocalPoint {
  const n = ring.length || 1
  return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n]
}

const FALLBACK_HALF_M = 15
const LOT_MARGIN = 0.35
const MIN_LOT_MARGIN_M = 8

/** The lot with a margin round it, in SVG coordinates. */
function lotBox(check: CheckResponse, design: DesignResult | null): ViewBox {
  const points: LocalPoint[] = [
    ...check.lot.polygon_local,
    ...(design?.placement_local ?? []),
    ...(design?.setbacks_local ? Object.values(design.setbacks_local).flat() : []),
  ]
  if (points.length === 0) return { x: -FALLBACK_HALF_M, y: -FALLBACK_HALF_M, w: FALLBACK_HALF_M * 2, h: FALLBACK_HALF_M * 2 }
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const margin = Math.max(MIN_LOT_MARGIN_M, Math.max(maxX - minX, maxY - minY) * LOT_MARGIN)
  return { x: minX - margin, y: -maxY - margin, w: maxX - minX + margin * 2, h: maxY - minY + margin * 2 }
}

/** Every permit within the radius, centred on the lot. */
function neighbourhoodBox(check: CheckResponse): ViewBox {
  const r = check.permits_nearby.radius_m || check.context.radius_m
  return { x: -r, y: -r, w: r * 2, h: r * 2 }
}

export function viewBoxFor(scale: PlanScale, check: CheckResponse, design: DesignResult | null): ViewBox {
  return scale === 'lot' ? lotBox(check, design) : neighbourhoodBox(check)
}

/** A round number of metres that makes a scale bar about `targetM` long. */
export function niceLength(targetM: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(targetM))
  const f = targetM / magnitude
  return (f >= 5 ? 5 : f >= 2 ? 2 : 1) * magnitude
}
