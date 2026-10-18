import { useEffect, useMemo, useRef } from 'react'
import type { Group } from 'three'
import type { DesignResult, LocalPoint } from '@contracts/types'
import { midpoint, openRing, seededRandom, signedArea } from './geometry'
import type { StreetFrame } from './streetFrame'
import { ease, progress } from './timeline'
import { useSequenceFrame } from './useSequence'
import { BED, FENCE, PATIO, Pieces, SHED, YardKit, type Plant } from './yardKit'
import { Plants } from './Plants'
import { yardMaterial } from './yardMaterial'

// The drawn look's garden behind the new building: wooden fences along the lot lines, a shed, a
// patio with a table, chairs and an umbrella, a flower bed, a raised vegetable bed and a row of
// shrubs, from the same pieces as every neighbour's yard (Yards.tsx). It appears once the floors
// have landed, and only behind a design that fits: a lived-in yard behind one that doesn't (or is
// too close to call) would read as built, and on a width or depth failure the fences would cross
// the building. It is laid out square to the building, which turns with a skewed lot's side lines
// (T20), and fenced along the lot's own lines: laid out square to the street, a lot that meets a
// curving street at an angle got a garden as wide as the lot's whole run along the street, its
// fences across the neighbours' yards and the road. Decoration only: nothing here is read from
// data, and none of it hides the design.

/** How far in from the lot lines the garden keeps. */
const MARGIN_M = 0.7
const BAND_M = 4.5
const POP_S = 0.5
/** Fences stand this far inside the lot line. */
const FENCE_INSET_M = 0.05
/** The step for measuring the lot behind the building. */
const SAMPLE_M = 0.5

/**
 * Where the line at `c` on one axis (0: x, 1: y) runs inside the ring: the stretch, along the other
 * axis, that holds `at`; null if `at` is outside.
 */
function span(ring: LocalPoint[], fixed: 0 | 1, c: number, at: number): [number, number] | null {
  const free = fixed === 0 ? 1 : 0
  const hits: number[] = []
  for (let i = 0; i < ring.length; i++) {
    const [a, b] = [ring[i], ring[(i + 1) % ring.length]]
    if (a[fixed] > c !== b[fixed] > c) hits.push(a[free] + ((c - a[fixed]) * (b[free] - a[free])) / (b[fixed] - a[fixed]))
  }
  hits.sort((p, q) => p - q)
  for (let i = 0; i + 1 < hits.length; i += 2) if (hits[i] <= at && at <= hits[i + 1]) return [hits[i], hits[i + 1]]
  return null
}

/** The part of the segment at or behind y = yMax, or null if none of it is. */
function behind(a: LocalPoint, b: LocalPoint, yMax: number): [LocalPoint, LocalPoint] | null {
  if (a[1] > yMax && b[1] > yMax) return null
  if (a[1] <= yMax && b[1] <= yMax) return [a, b]
  const t = (yMax - a[1]) / (b[1] - a[1])
  const cut: LocalPoint = [a[0] + t * (b[0] - a[0]), yMax]
  return a[1] <= yMax ? [a, cut] : [cut, b]
}

function plan(lot: LocalPoint[], design: DesignResult | null, street: StreetFrame) {
  const pieces = new Pieces(true)
  const plants: Plant[] = []
  const placement = design?.result === 'fits' ? design.placement_local : null
  if (!placement) return { geometry: null, plants }

  const random = seededRandom(street.mid)
  // The building's frame: x across it, y from the middle of its back wall toward its front wall.
  const [frontLeft, frontRight, rearRight, rearLeft] = openRing(placement)
  const back = midpoint(rearLeft, rearRight)
  const front = midpoint(frontLeft, frontRight)
  const length = Math.hypot(front[0] - back[0], front[1] - back[1])
  if (length < 1) return { geometry: null, plants }
  const toHouse: LocalPoint = [(front[0] - back[0]) / length, (front[1] - back[1]) / length]
  const across: LocalPoint = [-toHouse[1], toHouse[0]]
  const ring = openRing(lot).map(([x, y]): LocalPoint => {
    const [dx, dy] = [x - back[0], y - back[1]]
    return [dx * across[0] + dy * across[1], dx * toHouse[0] + dy * toHouse[1]]
  })

  // The rear yard: a rectangle square to the building that the lot holds behind it, as wide as the
  // lot just behind the back wall and from the rear lot line's nearest point to the back wall.
  const justBehind = span(ring, 1, -SAMPLE_M, 0)
  if (!justBehind) return { geometry: null, plants }
  let [xL, xR] = justBehind
  let yRear = -Infinity
  for (let x = xL + SAMPLE_M / 2; x < xR; x += SAMPLE_M) {
    const run = span(ring, 0, x, -SAMPLE_M)
    if (run) yRear = Math.max(yRear, run[0])
  }
  if (!Number.isFinite(yRear)) return { geometry: null, plants }
  for (let y = yRear + SAMPLE_M / 2; y < 0; y += SAMPLE_M) {
    const run = span(ring, 1, y, 0)
    if (run) [xL, xR] = [Math.max(xL, run[0]), Math.min(xR, run[1])]
  }
  const xMid = (xL + xR) / 2
  const width = xR - xL
  const depth = -yRear
  // The yard's frame: x across from the rectangle's middle, y from its rear toward the building.
  const rear: LocalPoint = [back[0] + across[0] * xMid + toHouse[0] * yRear, back[1] + across[1] * xMid + toHouse[1] * yRear]
  const kit = new YardKit({ rear, across, toHouse }, pieces, plants)
  // The back of the rear yard, clear of the building's stairs and walkout.
  const band = { from: MARGIN_M, to: Math.min(BAND_M, depth - 3.6) }

  // Fences along the lot lines, from the building's front wall back, just inside the lot.
  const inward = signedArea(ring) > 0 ? 1 : -1
  for (let i = 0; i < ring.length; i++) {
    const piece = behind(ring[i], ring[(i + 1) % ring.length], length)
    if (!piece) continue
    const [a, b] = piece
    const run = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (run < 1e-6) continue
    const [nx, ny] = [(-(b[1] - a[1]) / run) * inward * FENCE_INSET_M, ((b[0] - a[0]) / run) * inward * FENCE_INSET_M]
    kit.fence(a[0] + nx - xMid, a[1] + ny - yRear, b[0] + nx - xMid, b[1] + ny - yRear, FENCE.colours[0])
  }

  if (band.to - band.from > 1.6 && width > 5) {
    // Shed in the back left corner, the raised bed in the back right.
    kit.shed(-width / 2 + MARGIN_M + SHED.w / 2, band.from + SHED.d / 2, Math.floor(random() * SHED.colours.length))
    kit.raisedBed(width / 2 - MARGIN_M - 1.0, band.from + 0.5)
    // Patio in the middle of the band.
    kit.patio(0.6, (band.from + band.to) / 2, PATIO.umbrella[Math.floor(random() * PATIO.umbrella.length)])
    // Flower bed along the right fence, from the band toward the house.
    const bedFrom = band.from + 1.4
    const bedTo = Math.min(bedFrom + 6, Math.max(bedFrom + 1, depth - 3.8))
    kit.flowerBed(width / 2 - 0.1 - BED.w / 2, bedFrom, bedTo, random, -1)
    // Shrubs along the back fence, between the shed and the raised bed.
    for (let x = -width / 2 + MARGIN_M + SHED.w + 0.9; x < width / 2 - MARGIN_M - 2.2; x += 1.5) kit.shrub(x, 0.5, random)
  }
  return { geometry: pieces.empty ? null : pieces.geometry(), plants }
}

export function Garden({ lot, design, street }: { lot: LocalPoint[]; design: DesignResult | null; street: StreetFrame }) {
  const garden = useMemo(() => plan(lot, design, street), [lot, design, street])
  useEffect(() => () => garden.geometry?.dispose(), [garden])
  const material = useMemo(() => yardMaterial(true), [])
  useEffect(() => () => material.dispose(), [material])

  const group = useRef<Group>(null)
  const own = useRef(0)
  // The garden pops in as the floors land, each piece growing up where it stands.
  useSequenceFrame((t, { timeline }) => {
    own.current = ease.outBack(progress(t, { start: timeline.fail.start, end: timeline.fail.start + POP_S }))
    if (!group.current) return
    group.current.visible = own.current > 0
    group.current.scale.set(1, Math.max(own.current, 0.001), 1)
  })

  return (
    <group>
      <group ref={group} visible={false}>
        {garden.geometry && <mesh geometry={garden.geometry} material={material} castShadow receiveShadow dispose={null} />}
      </group>
      <Plants plants={garden.plants} ownGrowth={() => own.current} />
    </group>
  )
}
