import type { ContextBuilding, LocalPoint } from '@contracts/types'
import { openRing, seededRandom, signedArea, vertexMean } from './geometry'
import { inFrame, RIGHT_OF_WAY_M, ROAD_CENTRE_M, towardStreet, type StreetFrame } from './streetFrame'
import { BED, FENCE, PATIO, SHED, type YardKit, type YardFrame } from './yardKit'

// A back yard behind every house that has room for one (drawn look), so the whole street looks
// lived in, not just the lot being checked. A yard runs from the house's back wall to the block's
// rear lot line (taken at the checked lot's depth, from the street the house faces), across the
// house and half of each gap beside it, and stops short of any other building and of the checked
// lot. Garages and sheds in the City's massing, apartment blocks and houses with no room behind
// them get none. Decoration only: nothing here is read as data.

const YARD = {
  /** Smaller or lower than this, a "house" in the massing is a garage or a shed. */
  minFootprintM2: 40,
  minHeightM: 3.5,
  minWidthM: 3,
  minDepthM: 3,
  maxDepthM: 25,
  /** A house not square to the street (on a cross street): a yard this deep, if nothing is in the way. */
  defaultDepthM: 10,
  /** How square to the street a house must be to measure its yard to the block's rear line. */
  squareCos: 0.7,
  /** Into the gap beside the house, at most. */
  sideM: 1.5,
  /** Kept clear of the house's back wall and of whatever stops the yard. */
  clearM: 0.3,
  /** Side fences carry on past the back wall, along the house's sides. */
  fenceAlongHouseM: 2,
  /** Houses further than this from the lot are in the fog. */
  withinM: 260,
}

export interface PlannedYard {
  frame: YardFrame
  width: number
  depth: number
  /** The house's distance from the lot, so the yard grows in with it. */
  distance: number
  seed: number
}

interface Shape {
  building: ContextBuilding
  ring: LocalPoint[]
  centre: LocalPoint
  radius: number
}

function shapeOf(building: ContextBuilding): Shape {
  const ring = openRing(building.footprint_local)
  const centre = vertexMean(ring)
  return { building, ring, centre, radius: Math.max(...ring.map(([x, y]) => Math.hypot(x - centre[0], y - centre[1]))) }
}

export function planYards(buildings: ContextBuilding[], street: StreetFrame, lot: LocalPoint[]): PlannedYard[] {
  const shapes = buildings.map(shapeOf)
  const lotRing = openRing(lot)
  const lotCentre = vertexMean(lotRing)
  const obstacles: { ring: LocalPoint[]; centre: LocalPoint; radius: number; self?: ContextBuilding }[] = [
    ...shapes.map((s) => ({ ring: s.ring, centre: s.centre, radius: s.radius, self: s.building })),
    { ring: lotRing, centre: lotCentre, radius: Math.max(...lotRing.map(([x, y]) => Math.hypot(x - lotCentre[0], y - lotCentre[1]))) },
  ]

  const yards: PlannedYard[] = []
  for (const { building, ring, centre, radius } of shapes) {
    if (building.on_lot || building.kind !== 'house' || building.avg_height_m < YARD.minHeightM) continue
    if (Math.abs(signedArea(ring)) < YARD.minFootprintM2) continue
    const distance = Math.hypot(...centre)
    if (distance > YARD.withinM) continue

    // The yard's frame: toHouse is the way the house faces; across is its left-hand normal.
    const facing = towardStreet(street, centre)
    const back: LocalPoint = [-facing[0], -facing[1]]
    const across: LocalPoint = [-facing[1], facing[0]]
    const project = ([x, y]: LocalPoint) => {
      const [dx, dy] = [x - centre[0], y - centre[1]]
      return { s: dx * across[0] + dy * across[1], t: dx * back[0] + dy * back[1] }
    }
    const house = ring.map(project)
    const [s0, s1] = [Math.min(...house.map((p) => p.s)), Math.max(...house.map((p) => p.s))]
    const [h0, h1] = [Math.min(...house.map((p) => p.t)), Math.max(...house.map((p) => p.t))]

    // How deep: to the block's rear lot line when the house is square to the street.
    const k = back[0] * street.toward[0] + back[1] * street.toward[1]
    let depth = YARD.defaultDepthM
    if (Math.abs(k) > YARD.squareCos) {
      const o = inFrame(street, centre).o
      const rearLine = o < ROAD_CENTRE_M ? -street.lotDepthM : RIGHT_OF_WAY_M + street.lotDepthM
      depth = (rearLine - (o + h1 * k)) / k - 0.05
    }
    let t0 = h1 + YARD.clearM
    let t1 = h1 + Math.min(depth, YARD.maxDepthM)
    let [left, right] = [s0 - YARD.sideM, s1 + YARD.sideM]
    if (t1 - t0 < YARD.minDepthM) continue

    // Nearby buildings (and the lot): halfway into the gap beside the house, short of anything behind.
    const reach = radius + YARD.maxDepthM + YARD.sideM
    const near = obstacles
      .filter((ob) => ob.self !== building && Math.hypot(ob.centre[0] - centre[0], ob.centre[1] - centre[1]) < reach + ob.radius)
      .map((ob) => {
        const pts = ob.ring.map(project)
        return { s0: Math.min(...pts.map((p) => p.s)), s1: Math.max(...pts.map((p) => p.s)), t0: Math.min(...pts.map((p) => p.t)), t1: Math.max(...pts.map((p) => p.t)) }
      })
    for (const ob of near) {
      // Beside the house or its yard: the side stops halfway across the gap.
      if (ob.t1 > h0 && ob.t0 < t1) {
        if (ob.s0 >= s1 - 0.2) right = Math.min(right, (s1 + ob.s0) / 2)
        else if (ob.s1 <= s0 + 0.2) left = Math.max(left, (s0 + ob.s1) / 2)
      }
    }
    for (const ob of near) {
      if (ob.s1 <= left || ob.s0 >= right || ob.t1 <= t0 || ob.t0 >= t1) continue
      if (ob.t0 > t0 + YARD.minDepthM) {
        t1 = Math.min(t1, ob.t0 - YARD.clearM)
      } else if (ob.s1 < (s0 + s1) / 2) {
        left = Math.max(left, ob.s1 + YARD.clearM)
      } else if (ob.s0 > (s0 + s1) / 2) {
        right = Math.min(right, ob.s0 - YARD.clearM)
      } else {
        t1 = t0
      }
    }
    const width = right - left
    if (width < YARD.minWidthM || t1 - t0 < YARD.minDepthM) continue
    const mid = (left + right) / 2
    yards.push({
      frame: {
        rear: [centre[0] + back[0] * t1 + across[0] * mid, centre[1] + back[1] * t1 + across[1] * mid],
        across,
        toHouse: facing,
      },
      width,
      depth: t1 - t0,
      distance,
      seed: building.building_id,
    })
  }
  return yards
}

/**
 * A neighbour's yard, from the same pieces as the new building's garden, picked by the house's id:
 * fences round it, and as room allows a shed in a back corner, a raised bed in the other, a patio
 * near the house, a flower bed along one fence, the bins by the house and shrubs along the back.
 */
export function furnishYard(kit: YardKit, width: number, depth: number, seed: number): void {
  const random = seededRandom([seed, 7])
  const fence = FENCE.colours[Math.floor(random() * FENCE.colours.length)]
  const [xL, xR] = [-width / 2 + 0.06, width / 2 - 0.06]
  const houseWall = depth + YARD.clearM
  kit.fence(xL, 0.06, xR, 0.06, fence)
  kit.fence(xL, 0.06, xL, houseWall + YARD.fenceAlongHouseM, fence)
  kit.fence(xR, 0.06, xR, houseWall + YARD.fenceAlongHouseM, fence)

  const side: 1 | -1 = random() < 0.5 ? 1 : -1
  const corner = (w: number) => side * (width / 2 - 0.7 - w / 2)
  const taken: [number, number][] = []
  if (width >= 4.6 && depth >= 6 && random() < 0.55) {
    kit.shed(corner(SHED.w), 0.7 + SHED.d / 2, Math.floor(random() * SHED.colours.length))
    taken.push([corner(SHED.w) - SHED.w / 2 - 0.4, corner(SHED.w) + SHED.w / 2 + 0.4])
  }
  if (width >= 5 && depth >= 6 && random() < 0.35) {
    const x = -side * (width / 2 - 0.7 - 1.0)
    kit.raisedBed(x, 1.2)
    taken.push([x - 1.4, x + 1.4])
  }
  // A flower bed along one side fence, clear of a shed in that corner.
  const bedSide: 1 | -1 = random() < 0.5 ? 1 : -1
  let bed = false
  if (depth >= 7 && random() < 0.5) {
    const y0 = bedSide === side && taken.length ? 0.7 + SHED.d + 0.6 : 1.2
    const y1 = Math.min(y0 + 6, depth - 1.6)
    if (y1 - y0 >= 1.5) {
      kit.flowerBed(bedSide * (width / 2 - 0.1 - BED.w / 2), y0, y1, random, bedSide === 1 ? -1 : 1)
      bed = true
    }
  }
  // A patio by the house, clear of the flower bed.
  if (width >= PATIO.w + 1.6 && depth >= 8 && random() < 0.5) {
    const room = Math.max(0, width / 2 - 1.8 - (bed ? 0.9 : 0.3))
    const x = bed ? -bedSide * room * random() : (random() - 0.5) * 2 * room
    kit.patio(x, depth - 1.7, PATIO.umbrella[Math.floor(random() * PATIO.umbrella.length)])
  }
  // The bins against the other fence, by the house.
  if (random() < 0.6) {
    const binSide = bed ? -bedSide : side
    kit.bins(binSide * (width / 2 - 0.06), depth - 0.4, binSide === 1 ? -1 : 1)
  }
  // Shrubs along the back fence, where nothing else stands.
  for (let x = -width / 2 + 0.9; x <= width / 2 - 0.9; x += 1.6) {
    if (taken.some(([a, b]) => x > a && x < b) || random() < 0.3) continue
    kit.shrub(x, 0.5, random)
  }
}
