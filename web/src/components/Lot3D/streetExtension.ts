import type { ContextBuilding, LocalPoint } from '@contracts/types'
import { openRing, seededRandom } from './geometry'
import { fromFrame, inFrame, RIGHT_OF_WAY_M, ROAD_CENTRE_M, STREET, type StreetFrame } from './streetFrame'

// The street beyond the data. The City's buildings come within 150 m of the lot, so looking down
// the road used to show an empty lawn. Past the last real house on each side of the street, this
// continues the block in the street's own rhythm: the median width, depth, height, front setback
// and gap of that side's real houses, with a little seeded variety, until the road ends (where its
// centreline meets a real building) or MAX_REACH_M. Boulevard trees continue the same way. The
// houses are made up, and only ever beyond the real data.

export const MAX_REACH_M = 330
const MIN_REACH_M = 12
const REACH_STEP_M = 2
/** A real house faces this street when its front is within this of its lot line. */
const FACING_M = 12
const DEFAULTS = { width: 7, depth: 12, height: 8, setback: 5, gap: 1.4 }
const JITTER = { width: 0.12, height: 0.6, setback: 0.4 }
const TREE = { spacingM: 10, skip: 0.25 }
/** A side of the street is continued only when this many real houses face it. */
const MIN_FACING = 3
/** Made-up houses and trees stay this far outside the data's circle. */
const DATA_EDGE_MARGIN_M = 4
/** Made-up ids, far from the City's. */
const FIRST_ID = 9_000_000

/** Ray-casting point-in-polygon test. */
function inside([x, y]: LocalPoint, ring: LocalPoint[]): boolean {
  let hit = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

/** How far along the street, each way, the road's centreline runs before meeting a building. */
export function roadReach(frame: StreetFrame, buildings: ContextBuilding[]): { back: number; ahead: number } {
  const rings = buildings.filter((b) => !b.on_lot).map((b) => openRing(b.footprint_local))
  const run = (sign: number) => {
    for (let t = REACH_STEP_M; t <= MAX_REACH_M; t += REACH_STEP_M) {
      if (rings.some((ring) => inside(fromFrame(frame, sign * t, ROAD_CENTRE_M), ring))) return Math.max(MIN_REACH_M, t - REACH_STEP_M)
    }
    return MAX_REACH_M
  }
  return { back: run(-1), ahead: run(1) }
}

const median = (values: number[], fallback: number) => {
  if (!values.length) return fallback
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

interface Footprint {
  s0: number
  s1: number
  o0: number
  o1: number
  height: number
}

export function extendStreet(
  frame: StreetFrame,
  buildings: ContextBuilding[],
  trees: LocalPoint[],
  dataRadiusM: number,
): { buildings: ContextBuilding[]; trees: LocalPoint[] } {
  const reach = roadReach(frame, buildings)
  // Never inside the data's circle (around the lot's centroid, the origin): there an empty stretch
  // is real (a park, a school yard), not missing.
  const outsideData = (p: LocalPoint) => Math.hypot(...p) > dataRadiusM + DATA_EDGE_MARGIN_M
  const real: Footprint[] = buildings
    .filter((b) => !b.on_lot)
    .map((b) => {
      const pts = openRing(b.footprint_local).map((p) => inFrame(frame, p))
      const s = pts.map((p) => p.s)
      const o = pts.map((p) => p.o)
      return { s0: Math.min(...s), s1: Math.max(...s), o0: Math.min(...o), o1: Math.max(...o), height: b.avg_height_m }
    })
  const overlapsReal = (f: Footprint) => real.some((r) => r.s0 < f.s1 && f.s0 < r.s1 && r.o0 < f.o1 && f.o0 < r.o1)

  const made: ContextBuilding[] = []
  // This side of the street (fronts at o < 0, facing +o) and the far side (fronts beyond the right of way).
  for (const side of ['near', 'far'] as const) {
    const facing = real.filter((r) =>
      side === 'near' ? r.o1 <= 0.5 && r.o1 >= -FACING_M : r.o0 >= RIGHT_OF_WAY_M - 0.5 && r.o0 <= RIGHT_OF_WAY_M + FACING_M,
    )
    if (facing.length < MIN_FACING) continue
    const ordered = [...facing].sort((a, b) => a.s0 - b.s0)
    const gaps = ordered.slice(1).map((r, i) => Math.min(4, Math.max(0, r.s0 - ordered[i].s1)))
    const rhythm = {
      width: median(facing.map((r) => r.s1 - r.s0), DEFAULTS.width),
      depth: median(facing.map((r) => r.o1 - r.o0), DEFAULTS.depth),
      height: median(facing.map((r) => r.height), DEFAULTS.height),
      setback: median(facing.map((r) => (side === 'near' ? -r.o1 : r.o0 - RIGHT_OF_WAY_M)), DEFAULTS.setback),
      gap: median(gaps, DEFAULTS.gap),
    }
    const ends = { ahead: Math.max(0, ...facing.map((r) => r.s1)), back: Math.min(0, ...facing.map((r) => r.s0)) }

    for (const sign of [1, -1]) {
      const limit = sign > 0 ? reach.ahead : reach.back
      // Only past the real houses, and only where the road keeps going past them.
      let s = (sign > 0 ? ends.ahead : -ends.back) + rhythm.gap
      if (limit < MAX_REACH_M && limit <= s) continue
      while (s < limit) {
        const random = seededRandom([sign * s, side === 'near' ? 1 : 2])
        const width = rhythm.width * (1 + (random() - 0.5) * 2 * JITTER.width)
        const setback = rhythm.setback + (random() - 0.5) * 2 * JITTER.setback
        const front = side === 'near' ? -setback : RIGHT_OF_WAY_M + setback
        const [o0, o1] = side === 'near' ? [front - rhythm.depth, front] : [front, front + rhythm.depth]
        const [s0, s1] = sign > 0 ? [s, s + width] : [-s - width, -s]
        const footprint = { s0, s1, o0, o1, height: rhythm.height + (random() - 0.5) * 2 * JITTER.height }
        const centre = fromFrame(frame, (s0 + s1) / 2, (o0 + o1) / 2)
        if (!overlapsReal(footprint) && outsideData(centre)) {
          const corners: LocalPoint[] = [
            fromFrame(frame, s0, o0),
            fromFrame(frame, s1, o0),
            fromFrame(frame, s1, o1),
            fromFrame(frame, s0, o1),
          ]
          made.push({
            building_id: FIRST_ID + made.length,
            avg_height_m: Math.max(5.5, footprint.height),
            kind: 'house',
            on_lot: false,
            footprint_local: [...corners, corners[0]],
          })
        }
        s += width + rhythm.gap
      }
    }
  }

  // Boulevard trees past the real ones, on both sides.
  const boulevard = STREET.gapM + STREET.sidewalkM + STREET.boulevardM / 2
  const rows = [boulevard, RIGHT_OF_WAY_M - boulevard]
  const realReach = Math.max(0, ...trees.map((t) => Math.abs(inFrame(frame, t).s)))
  const moreTrees: LocalPoint[] = []
  for (const o of rows) {
    for (const sign of [1, -1]) {
      const limit = sign > 0 ? reach.ahead : reach.back
      for (let s = realReach + TREE.spacingM; s < limit; s += TREE.spacingM) {
        const at = fromFrame(frame, sign * s, o)
        if (seededRandom([sign * s, o])() < TREE.skip || !outsideData(at)) continue
        moreTrees.push(at)
      }
    }
  }
  return { buildings: made, trees: moreTrees }
}
