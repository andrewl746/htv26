import { useEffect, useMemo, useRef } from 'react'
import type { Group } from 'three'
import type { DesignResult, LocalPoint } from '@contracts/types'
import { openRing, seededRandom } from './geometry'
import { fromFrame, inFrame, type StreetFrame } from './streetFrame'
import { ease, progress } from './timeline'
import { useSequenceFrame } from './useSequence'
import { BED, FENCE, PATIO, Pieces, SHED, YardKit, type Plant } from './yardKit'
import { Plants } from './Plants'
import { yardMaterial } from './yardMaterial'

// The drawn look's garden behind the new building: wooden fences down the sides and across the
// back, a shed, a patio with a table, chairs and an umbrella, a flower bed, a raised vegetable bed
// and a row of shrubs, from the same pieces as every neighbour's yard (Yards.tsx). It appears once
// the floors have landed, and only behind a design that fits: a lived-in yard behind one that
// doesn't (or is too close to call) would read as built, and on a width or depth failure the fences
// would cross the building. Decoration only: nothing here is read from data, and none of it hides
// the design.

/** How far in from the lot lines the garden keeps. */
const MARGIN_M = 0.7
const BAND_M = 4.5
const POP_S = 0.5

function plan(lot: LocalPoint[], design: DesignResult | null, street: StreetFrame) {
  const pieces = new Pieces(true)
  const plants: Plant[] = []
  const placement = design?.result === 'fits' ? design.placement_local : null
  if (!placement) return { geometry: null, plants }

  const random = seededRandom(street.mid)
  const ring = openRing(lot).map((p) => inFrame(street, p))
  const house = openRing(placement).map((p) => inFrame(street, p))
  const [sMin, sMax] = [Math.min(...ring.map((p) => p.s)), Math.max(...ring.map((p) => p.s))]
  const oRear = Math.min(...ring.map((p) => p.o))
  const oFront = Math.max(...house.map((p) => p.o))
  const oBack = Math.min(...house.map((p) => p.o))
  // The yard's frame: x across from the lot's middle, y from the rear lot line toward the street.
  const kit = new YardKit({ rear: fromFrame(street, (sMin + sMax) / 2, oRear), across: street.along, toHouse: street.toward }, pieces, plants)
  const width = sMax - sMin
  const [xL, xR] = [-width / 2 + 0.05, width / 2 - 0.05]
  // The back of the rear yard, clear of the building's stairs and walkout.
  const band = { from: MARGIN_M, to: Math.min(BAND_M, oBack - oRear - 3.6) }

  // Fences: down both sides from the building's front wall back, and across the rear.
  kit.fence(xL, oFront - oRear, xL, 0.05, FENCE.colours[0])
  kit.fence(xR, oFront - oRear, xR, 0.05, FENCE.colours[0])
  kit.fence(xL, 0.05, xR, 0.05, FENCE.colours[0])

  if (band.to - band.from > 1.6 && width > 5) {
    // Shed in the back left corner, the raised bed in the back right.
    kit.shed(-width / 2 + MARGIN_M + SHED.w / 2, band.from + SHED.d / 2, Math.floor(random() * SHED.colours.length))
    kit.raisedBed(width / 2 - MARGIN_M - 1.0, band.from + 0.5)
    // Patio in the middle of the band.
    kit.patio(0.6, (band.from + band.to) / 2, PATIO.umbrella[Math.floor(random() * PATIO.umbrella.length)])
    // Flower bed along the right fence, from the band toward the house.
    const bedFrom = band.from + 1.4
    const bedTo = Math.min(bedFrom + 6, Math.max(bedFrom + 1, oBack - oRear - 3.8))
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
