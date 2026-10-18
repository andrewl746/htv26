import type { ContextBuilding, LocalPoint } from '@contracts/types'
import { openRing, seededRandom, signedArea, vertexMean } from './geometry'
import type { RoadClass } from './osmMap'
import { roadRects, type RoadPiece } from './roadMesh'
import { fromFrame, inFrame, RIGHT_OF_WAY_M, ROAD_CENTRE_M, towardStreet, type StreetFrame } from './streetFrame'
import { BED, FENCE, PATIO, SHED, type YardKit, type YardFrame } from './yardKit'

// A back yard behind every house that has room for one (drawn look), so the whole street looks
// lived in, not just the lot being checked. A yard is square to its own house, behind it as seen
// from the street it faces (the nearest street on the map; without the map, the lot's street and
// the blocks parallel to it). On the lot's street and those blocks it runs back to the block's rear
// lot line (taken at the checked lot's depth); elsewhere it is YARD.defaultDepthM deep. It spans
// the house and half of each gap beside it, stops halfway to a house behind, and short of any other
// building, of the checked lot and of the roads with their sidewalks, lanes and driveways, the lot's
// own street included. Garages and sheds in the City's massing, apartment blocks and houses with no
// room behind them get none. Decoration only: nothing here is read as data.

const YARD = {
  /** Smaller or lower than this, a "house" in the massing is a garage or a shed. */
  minFootprintM2: 40,
  minHeightM: 3.5,
  minWidthM: 3,
  minDepthM: 3,
  maxDepthM: 25,
  /** Off the lot's street and the blocks parallel to it: a yard this deep, if nothing is in the way. */
  defaultDepthM: 10,
  /** How square to the lot's street a house must face to measure its yard to the block's rear line. */
  squareCos: 0.7,
  /** Into the gap beside the house, at most. */
  sideM: 1.5,
  /** Kept clear of the house's back wall and of whatever stops the yard. */
  clearM: 0.3,
  /** Side fences carry on past the back wall, along the house's sides. */
  fenceAlongHouseM: 2,
  /** Houses further than this from the lot are in the fog. */
  withinM: 260,
  /** A house faces the nearest street within this; past it, the lot's street decides. */
  streetWithinM: 60,
}
const GRID_CELL_M = 30
/** The streets a house can face: not lanes, driveways, parking aisles, paths or motorways. */
const FACED: ReadonlySet<RoadClass> = new Set(['trunk', 'primary', 'secondary', 'tertiary', 'minor'])
/** Past a block's depth by this, a house is on the next block (as towardStreet has it). */
const NEXT_STREET_MARGIN_M = 3
/** The lot's own street as obstacles: pieces this long. */
const FRONTAGE_PIECE_M = 6

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

/** The four ways a house can face: along its longest wall, either way, and square to it, either way. */
function waysOut(ring: LocalPoint[]): LocalPoint[] {
  let way: LocalPoint = [1, 0]
  let longest = 0
  for (let i = 0; i < ring.length; i++) {
    const [a, b] = [ring[i], ring[(i + 1) % ring.length]]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (len > longest) [longest, way] = [len, [(b[0] - a[0]) / len, (b[1] - a[1]) / len]]
  }
  return [way, [-way[1], way[0]], [-way[0], -way[1]], [way[1], -way[0]]]
}

const dot = (a: LocalPoint, b: LocalPoint) => a[0] * b[0] + a[1] * b[1]

function closest(p: LocalPoint, a: LocalPoint, b: LocalPoint): LocalPoint {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]]
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)))
  return [a[0] + dx * t, a[1] + dy * t]
}

export function planYards(
  buildings: ContextBuilding[],
  street: StreetFrame,
  lot: LocalPoint[],
  roads: RoadPiece[] = [],
  /** How far the lot's own street runs each way (roadReach), as Frontage.tsx draws it. */
  reach: { back: number; ahead: number } | null = null,
): PlannedYard[] {
  const shapes = buildings.map(shapeOf)
  const hasYard = ({ building, ring }: Shape) =>
    !building.on_lot &&
    building.kind === 'house' &&
    building.avg_height_m >= YARD.minHeightM &&
    Math.abs(signedArea(ring)) >= YARD.minFootprintM2
  const around = (ring: LocalPoint[]) => {
    const centre = vertexMean(ring)
    let radius = 0
    for (const [x, y] of ring) radius = Math.max(radius, Math.hypot(x - centre[0], y - centre[1]))
    return { ring, centre, radius }
  }
  // The streets a house can face (in pieces), and the lot's own street: its centreline among them,
  // and sidewalk to sidewalk as an obstacle (the map's copy of it is left out where this one runs).
  type Segment = [LocalPoint, LocalPoint]
  const streets: Segment[] = roads
    .filter((r) => FACED.has(r.kind))
    .flatMap((r) => r.line.slice(1).map((q, i): Segment => [r.line[i], q]))
  const frontage: LocalPoint[][] = []
  if (reach) {
    const [from, run] = [-reach.back, reach.back + reach.ahead]
    const count = Math.max(1, Math.ceil(run / FRONTAGE_PIECE_M))
    for (let i = 0; i < count; i++) {
      const [a, b] = [from + (run * i) / count, from + (run * (i + 1)) / count]
      frontage.push([fromFrame(street, a, 0), fromFrame(street, b, 0), fromFrame(street, b, RIGHT_OF_WAY_M), fromFrame(street, a, RIGHT_OF_WAY_M)])
      streets.push([fromFrame(street, a, ROAD_CENTRE_M), fromFrame(street, b, ROAD_CENTRE_M)])
    }
  }
  // Other buildings, the checked lot, and the roads with their sidewalks, lanes and driveways.
  type Obstacle = { ring: LocalPoint[]; centre: LocalPoint; radius: number; self?: ContextBuilding; house?: boolean }
  const obstacles: Obstacle[] = [
    ...shapes.map((s) => ({ ring: s.ring, centre: s.centre, radius: s.radius, self: s.building, house: hasYard(s) })),
    around(openRing(lot)),
    ...roadRects(roads).map(around),
    ...frontage.map(around),
  ]
  // Filed in a grid, so a house meets only the obstacles round it.
  const cellsOver = (centre: LocalPoint, r: number) => {
    const keys: string[] = []
    for (let cx = Math.floor((centre[0] - r) / GRID_CELL_M); cx <= Math.floor((centre[0] + r) / GRID_CELL_M); cx++) {
      for (let cy = Math.floor((centre[1] - r) / GRID_CELL_M); cy <= Math.floor((centre[1] + r) / GRID_CELL_M); cy++) keys.push(`${cx},${cy}`)
    }
    return keys
  }
  const file = <T>(grid: Map<string, T[]>, item: T, centre: LocalPoint, r: number) => {
    for (const key of cellsOver(centre, r)) {
      const cell = grid.get(key)
      if (cell) cell.push(item)
      else grid.set(key, [item])
    }
  }
  const cells = new Map<string, Obstacle[]>()
  for (const ob of obstacles) file(cells, ob, ob.centre, ob.radius)

  // The streets filed the same way, so a house meets the ones near it.
  const streetCells = new Map<string, Segment[]>()
  for (const [a, b] of streets) {
    const centre: LocalPoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    file(streetCells, [a, b], centre, Math.hypot(b[0] - a[0], b[1] - a[1]) / 2)
  }
  /** The way to the nearest street within YARD.streetWithinM, or null. */
  const towardNearest = (centre: LocalPoint): LocalPoint | null => {
    let [best, way] = [YARD.streetWithinM, null as LocalPoint | null]
    const nearby = new Set(cellsOver(centre, YARD.streetWithinM).flatMap((key) => streetCells.get(key) ?? []))
    for (const [a, b] of nearby) {
      const p = closest(centre, a, b)
      const d = Math.hypot(p[0] - centre[0], p[1] - centre[1])
      if (d < best && d > 1e-6) [best, way] = [d, [(p[0] - centre[0]) / d, (p[1] - centre[1]) / d]]
    }
    return way
  }

  const yards: PlannedYard[] = []
  for (const shape of shapes) {
    const { building, ring, centre, radius } = shape
    if (!hasYard(shape)) continue
    const distance = Math.hypot(...centre)
    if (distance > YARD.withinM) continue

    // The yard's frame: facing is the way the house faces, square to its walls, toward its street
    // (the nearest on the map; without the map, as the lot's street has it); across is its
    // left-hand normal.
    const lotWay = towardStreet(street, centre)
    const want = (roads.length ? towardNearest(centre) : null) ?? lotWay
    const facing = waysOut(ring).reduce((best, way) => (dot(way, want) > dot(best, want) ? way : best))
    const back: LocalPoint = [-facing[0], -facing[1]]
    const across: LocalPoint = [-facing[1], facing[0]]
    const project = ([x, y]: LocalPoint) => {
      const [dx, dy] = [x - centre[0], y - centre[1]]
      return { s: dx * across[0] + dy * across[1], t: dx * back[0] + dy * back[1] }
    }
    const house = ring.map(project)
    const [s0, s1] = [Math.min(...house.map((p) => p.s)), Math.max(...house.map((p) => p.s))]
    const [h0, h1] = [Math.min(...house.map((p) => p.t)), Math.max(...house.map((p) => p.t))]

    // How deep: on the lot's street and the blocks either side of it, facing the way the lot's
    // street has it, to the block's rear lot line; elsewhere a default.
    const k = dot(back, street.toward)
    const o = inFrame(street, centre).o
    const blocks = 2 * street.lotDepthM + NEXT_STREET_MARGIN_M
    let depth = YARD.defaultDepthM
    if (dot(facing, lotWay) > YARD.squareCos && o > -blocks && o < RIGHT_OF_WAY_M + blocks) {
      const rearLine = o < ROAD_CENTRE_M ? -street.lotDepthM : RIGHT_OF_WAY_M + street.lotDepthM
      depth = (rearLine - (o + h1 * k)) / k - 0.05
    }
    let t0 = h1 + YARD.clearM
    let t1 = h1 + Math.min(depth, YARD.maxDepthM)
    let [left, right] = [s0 - YARD.sideM, s1 + YARD.sideM]
    if (t1 - t0 < YARD.minDepthM) continue

    // Nearby buildings (and the lot and roads): halfway into the gap beside the house, halfway to a
    // house behind, short of anything else behind.
    const within = radius + YARD.maxDepthM + YARD.sideM
    const candidates = new Set(cellsOver(centre, within).flatMap((key) => cells.get(key) ?? []))
    const near = [...candidates]
      .filter((ob) => ob.self !== building && Math.hypot(ob.centre[0] - centre[0], ob.centre[1] - centre[1]) < within + ob.radius)
      .map((ob) => {
        const pts = ob.ring.map(project)
        return {
          s0: Math.min(...pts.map((p) => p.s)),
          s1: Math.max(...pts.map((p) => p.s)),
          t0: Math.min(...pts.map((p) => p.t)),
          t1: Math.max(...pts.map((p) => p.t)),
          house: ob.house === true,
        }
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
        // A house behind has its own yard coming the other way: the two meet halfway.
        t1 = Math.min(t1, ob.house ? (h1 + ob.t0) / 2 : ob.t0 - YARD.clearM)
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
