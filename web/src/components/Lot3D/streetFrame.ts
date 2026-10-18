import type { LocalPoint } from '@contracts/types'

// The street in front of the lot, as a frame: the middle of the lot's frontage, the direction the
// street runs, and the normal pointing from the lot toward the street. The frontage road, the
// houses' front doors and the houses that continue the street all read it.

/** A typical Toronto local street, outward from the lot line. */
export const STREET = {
  /** The sidewalk starts just outside the lot line. */
  gapM: 0.3,
  sidewalkM: 1.8,
  boulevardM: 1.6,
  curbM: 0.15,
  curbHeightM: 0.12,
  roadM: 8.5,
}

/** Lot line to the road's centreline. */
export const ROAD_CENTRE_M = STREET.gapM + STREET.sidewalkM + STREET.boulevardM + STREET.curbM + STREET.roadM / 2
/** Lot line to the far lot line, across the street. */
export const RIGHT_OF_WAY_M = 2 * (STREET.gapM + STREET.sidewalkM + STREET.boulevardM + STREET.curbM) + STREET.roadM

export interface StreetFrame {
  /** The middle of the frontage, on the lot line. */
  mid: LocalPoint
  /** Unit vector along the street. */
  along: LocalPoint
  /** Unit vector from the lot toward the street (the right-hand normal of `along`). */
  toward: LocalPoint
  /** How deep the lot runs back from the street: past it, houses belong to the next street. */
  lotDepthM: number
}

/** Without the lot's shape: a typical Toronto lot depth. */
const DEFAULT_LOT_DEPTH_M = 36
/** Houses this far past a block's depth face the next street. */
const NEXT_STREET_MARGIN_M = 3

export function streetFrame(edge: [LocalPoint, LocalPoint], lot: LocalPoint[] | null = null): StreetFrame {
  const [p, q] = edge
  const mid: LocalPoint = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
  let d: LocalPoint = [q[0] - p[0], q[1] - p[1]]
  const len = Math.hypot(...d) || 1
  d = [d[0] / len, d[1] / len]
  // The lot's centroid is the origin, so the normal toward the street points away from it.
  if (d[1] * mid[0] - d[0] * mid[1] < 0) d = [-d[0], -d[1]]
  const toward: LocalPoint = [d[1], -d[0]]
  const depth = lot?.length
    ? -Math.min(...lot.map(([x, y]) => (x - mid[0]) * toward[0] + (y - mid[1]) * toward[1]))
    : DEFAULT_LOT_DEPTH_M
  return { mid, along: d, toward, lotDepthM: depth > 0 ? depth : DEFAULT_LOT_DEPTH_M }
}

/** Coordinates in the frame: s along the street from the frontage's middle, o out from the lot line. */
export function inFrame(frame: StreetFrame, [x, y]: LocalPoint): { s: number; o: number } {
  const [dx, dy] = [x - frame.mid[0], y - frame.mid[1]]
  return { s: dx * frame.along[0] + dy * frame.along[1], o: dx * frame.toward[0] + dy * frame.toward[1] }
}

/** The point at s along the street and o out from the lot line. */
export function fromFrame(frame: StreetFrame, s: number, o: number): LocalPoint {
  return [frame.mid[0] + frame.along[0] * s + frame.toward[0] * o, frame.mid[1] + frame.along[1] * s + frame.toward[1] * o]
}

/**
 * Which way a building at this point faces: toward the road's centreline; or, on the next block
 * (behind this side's lots, or past the far side's), away from it, toward that block's own street.
 */
export function towardStreet(frame: StreetFrame | null, at: LocalPoint): LocalPoint {
  if (!frame) {
    // No frontage: face the lot being checked.
    const len = Math.hypot(...at) || 1
    return [-at[0] / len, -at[1] / len]
  }
  const { o } = inFrame(frame, at)
  const away: LocalPoint = [-frame.toward[0], -frame.toward[1]]
  if (o < -frame.lotDepthM - NEXT_STREET_MARGIN_M) return away
  if (o > RIGHT_OF_WAY_M + frame.lotDepthM + NEXT_STREET_MARGIN_M) return frame.toward
  return o < ROAD_CENTRE_M ? frame.toward : away
}
