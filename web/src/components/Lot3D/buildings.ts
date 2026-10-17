import { BoxGeometry, BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, type Object3D } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { ContextBuilding, LocalPoint } from '@contracts/types'
import { SLOT_ATTRIBUTE } from './cutaway'
import { openRing, seededIndex, shapeFrom, signedArea, vertexMean } from './geometry'
import type { Box } from './occlusion'
import { ease, lerp } from './timeline'

// Neighbouring buildings (MASTERSPEC 6.3 step 2): houses get a cartoon gable roof with the ridge
// along the footprint's long axis; large buildings stay flat with a parapet. Roofs are squared up
// to the street's grid, so a row of houses reads as parallel roofs rather than a scatter of angles.
const ROOF_PITCH_DEG = 30
const ROOF_RIDGE_MAX_M = 2.5
/**
 * The roof overhangs the gable ends only. Along the eaves, where semis and row houses meet, an
 * overhang would reach into the roof next door and flicker against it.
 */
const GABLE_OVERHANG_M = 0.3
/** A house whose walls run within this of the street's grid is squared up to it. */
const GRID_SNAP_DEG = 10
/** A footprint closer to square than this has no clear long axis; its ridge runs the street's way. */
const SQUARE_ASPECT = 1.25
const PARAPET_HEIGHT_M = 0.5
const PARAPET_THICKNESS_M = 0.3
/** Buildings start a little narrower than their footprint while they grow up. */
const GROW_START_WIDTH = 0.85

export const NEIGHBOUR_TOKENS = [1, 2, 3, 4, 5].map((i) => `--suplex-neighbour-${i}`)

/** The top of a building, roof or parapet included. */
export function buildingTop(building: ContextBuilding): number {
  return building.avg_height_m + (building.kind === 'house' ? ROOF_RIDGE_MAX_M : PARAPET_HEIGHT_M)
}

/** Scales a building up from the ground with a slight overshoot; p runs from 0 to 1. */
export function applyGrowth(object: Object3D, p: number): void {
  object.visible = p > 0
  const width = lerp(GROW_START_WIDTH, 1, ease.outCubic(p))
  object.scale.set(width, Math.max(ease.outBack(p), 0.001), width)
}

export interface BuiltBuilding {
  /** The massing id. Not unique: the parts of a polygon cut by the lot line share it, and its colour. */
  id: number
  /** Base centre in scene x and z; the geometries sit around it so the building can grow in place. */
  x: number
  z: number
  distance: number
  colorIndex: number
  /** Walls, plus the parapet on large buildings. */
  body: BufferGeometry
  roof: BufferGeometry | null
  /** What can hide the design: the footprint's squared-up box, roof included. */
  box: Box
}

/** How a street's houses are turned: the way most walls run, and the way most ridges run. */
export interface StreetGrid {
  /** Radians, modulo a quarter turn; null without houses. */
  wallRad: number | null
  /** Radians, modulo a half turn; null without a house that has a clear long axis. */
  ridgeRad: number | null
}

export function streetGrid(buildings: ContextBuilding[]): StreetGrid {
  const houses = buildings.filter((b) => b.kind === 'house').map((b) => openRing(b.footprint_local))
  if (houses.length === 0) return { wallRad: null, ridgeRad: null }
  const walls = houses.map(wallSum).reduce(addSums, [0, 0])
  const wallRad = angleOf(walls, 4)

  let ridges: Sum = [0, 0]
  for (const ring of houses) {
    const box = squaredBox(ring, vertexMean(ring), { wallRad, ridgeRad: null })
    if (!box.clear) continue
    const weight = Math.abs(signedArea(ring))
    ridges = addSums(ridges, [weight * Math.cos(2 * box.ridgeRad), weight * Math.sin(2 * box.ridgeRad)])
  }
  return { wallRad, ridgeRad: ridges[0] === 0 && ridges[1] === 0 ? null : angleOf(ridges, 2) }
}

export function buildBuilding(building: ContextBuilding, grid: StreetGrid): BuiltBuilding {
  const ring = openRing(building.footprint_local)
  const [cx, cy] = vertexMean(ring)
  const height = building.avg_height_m

  const walls = new ExtrudeGeometry(shapeFrom(ring), { depth: height, bevelEnabled: false }).rotateX(-Math.PI / 2)
  walls.translate(-cx, 0, cy)

  let body: BufferGeometry = walls
  let roof: BufferGeometry | null = null
  if (building.kind === 'house') {
    roof = gableRoof(ring, [cx, cy], height, grid)
  } else {
    body = mergeGeometries([walls, ...parapet(ring, [cx, cy], height)]) ?? walls
  }

  return {
    id: building.building_id,
    x: cx,
    z: -cy,
    distance: Math.hypot(cx, cy),
    colorIndex: seededIndex(building.building_id, NEIGHBOUR_TOKENS.length),
    body,
    roof,
    box: boxOf(ring, [cx, cy], grid, buildingTop(building)),
  }
}

/** Tags every vertex of a building with its slot in the cutaway's sink texture (before merging). */
export function setSlot(built: BuiltBuilding, slot: number): void {
  for (const geometry of [built.body, built.roof]) {
    if (!geometry) continue
    const slots = new Float32Array(geometry.getAttribute('position').count).fill(slot)
    geometry.setAttribute(SLOT_ATTRIBUTE, new Float32BufferAttribute(slots, 1))
  }
}

export function disposeBuilt(built: BuiltBuilding[]): void {
  for (const b of built) {
    b.body.dispose()
    b.roof?.dispose()
  }
}

/** One geometry per wall colour, and one for every roof, in scene coordinates (for after the ripple). */
export function mergeStreet(built: BuiltBuilding[]): { bodies: (BufferGeometry | null)[]; roofs: BufferGeometry | null } {
  const placed = (g: BufferGeometry, b: BuiltBuilding) => g.clone().translate(b.x, 0, b.z)
  const merge = (geometries: BufferGeometry[]) => {
    const merged = geometries.length ? mergeGeometries(geometries) : null
    geometries.forEach((g) => g.dispose())
    return merged
  }
  const bodies = NEIGHBOUR_TOKENS.map((_, i) => merge(built.filter((b) => b.colorIndex === i).map((b) => placed(b.body, b))))
  const roofs = merge(built.flatMap((b) => (b.roof ? [placed(b.roof, b)] : [])))
  return { bodies, roofs }
}

type Sum = [number, number]

const addSums = ([a, b]: Sum, [c, d]: Sum): Sum => [a + c, b + d]

/** The mean angle of a sum of (cos kφ, sin kφ), which is defined modulo a k-th of a turn. */
const angleOf = ([c, s]: Sum, k: number) => Math.atan2(s, c) / k

/** An angle wrapped into [-period / 2, period / 2). */
const wrap = (angle: number, period: number) => ((((angle + period / 2) % period) + period) % period) - period / 2

/**
 * Σ length·(cos 4φ, sin 4φ) over a footprint's edges. Walls at right angles to each other add up
 * rather than cancel, and long walls outweigh the short edges of porches and bay windows, so the
 * angle of the sum is the way the house's walls run.
 */
function wallSum(ring: LocalPoint[]): Sum {
  let c = 0
  let s = 0
  ring.forEach(([x, y], i) => {
    const [nx, ny] = ring[(i + 1) % ring.length]
    const length = Math.hypot(nx - x, ny - y)
    const phi = Math.atan2(ny - y, nx - x)
    c += length * Math.cos(4 * phi)
    s += length * Math.sin(4 * phi)
  })
  return [c, s]
}

/**
 * The footprint's bounding box turned to its walls (or the street's, when they are close), with
 * axis a along the ridge and b counter-clockwise of it, across the roof.
 */
function squaredBox(ring: LocalPoint[], [cx, cy]: LocalPoint, grid: StreetGrid) {
  let angle = angleOf(wallSum(ring), 4)
  if (grid.wallRad !== null && Math.abs(wrap(angle - grid.wallRad, Math.PI / 2)) < (GRID_SNAP_DEG * Math.PI) / 180) {
    angle = grid.wallRad
  }
  const extent = (axis: LocalPoint): [number, number] => {
    const values = ring.map(([x, y]) => (x - cx) * axis[0] + (y - cy) * axis[1])
    return [Math.min(...values), Math.max(...values)]
  }
  let a: LocalPoint = [Math.cos(angle), Math.sin(angle)]
  let b: LocalPoint = [-a[1], a[0]]
  const [along, across] = [a, b].map((axis) => {
    const [lo, hi] = extent(axis)
    return hi - lo
  })
  const clear = Math.max(along, across) >= SQUARE_ASPECT * Math.min(along, across)
  const ridgeAcross =
    clear || grid.ridgeRad === null
      ? along < across
      : Math.abs(wrap(angle + Math.PI / 2 - grid.ridgeRad, Math.PI)) < Math.abs(wrap(angle - grid.ridgeRad, Math.PI))
  if (ridgeAcross) {
    // Turn both axes a quarter so the ridge runs along a and b stays counter-clockwise of a.
    ;[a, b] = [b, [-a[0], -a[1]]]
    angle += Math.PI / 2
  }
  return { a, b, ea: extent(a), eb: extent(b), ridgeRad: angle, clear }
}

/** The squared-up bounding box in scene coordinates, for the sight-line tests. */
function boxOf(ring: LocalPoint[], centre: LocalPoint, grid: StreetGrid, top: number): Box {
  const { a, b, ea, eb } = squaredBox(ring, centre, grid)
  const [mu, mv] = [(ea[0] + ea[1]) / 2, (eb[0] + eb[1]) / 2]
  const east = centre[0] + a[0] * mu + b[0] * mv
  const north = centre[1] + a[1] * mu + b[1] * mv
  return {
    x: east,
    z: -north,
    ux: a[0],
    uz: -a[1],
    halfU: (ea[1] - ea[0]) / 2,
    halfV: (eb[1] - eb[0]) / 2,
    top,
  }
}

/** A triangular prism over the footprint's squared-up bounding box, its ridge along axis a. */
function gableRoof(ring: LocalPoint[], centre: LocalPoint, wallHeight: number, grid: StreetGrid): BufferGeometry {
  const { a, b, ea, eb } = squaredBox(ring, centre, grid)
  const o = GABLE_OVERHANG_M
  const [a0, a1] = [ea[0] - o, ea[1] + o]
  const [b0, b1] = eb
  const bm = (b0 + b1) / 2
  const rise = Math.min(ROOF_RIDGE_MAX_M, ((b1 - b0) / 2) * Math.tan((ROOF_PITCH_DEG * Math.PI) / 180))

  // Corners around the base centre in scene coordinates: local (east, north, up) -> (x, up, -north).
  const at = (u: number, v: number, up: number) => [u * a[0] + v * b[0], up, -(u * a[1] + v * b[1])]
  const h = wallHeight
  const e0a = at(a0, b0, h)
  const e0b = at(a1, b0, h)
  const e1a = at(a0, b1, h)
  const e1b = at(a1, b1, h)
  const ra = at(a0, bm, h + rise)
  const rb = at(a1, bm, h + rise)

  // Each triangle is counter-clockwise seen from outside.
  const triangles = [
    [e0a, e0b, rb], [e0a, rb, ra], // slope on the b0 side
    [e1b, e1a, ra], [e1b, ra, rb], // slope on the b1 side
    [e0a, ra, e1a], // gable at a0
    [e0b, e1b, rb], // gable at a1
  ]
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(triangles.flat(2), 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(new Array(triangles.length * 3 * 2).fill(0), 2))
  geometry.computeVertexNormals()
  return geometry
}

/** One thin box along each edge, just inside it, standing on the roof. */
function parapet(ring: LocalPoint[], [cx, cy]: LocalPoint, roofHeight: number): BufferGeometry[] {
  const inward = signedArea(ring) > 0 ? 1 : -1
  return ring.map(([x, y], i) => {
    const [nx, ny] = ring[(i + 1) % ring.length]
    const [dx, dy] = [nx - x, ny - y]
    const length = Math.hypot(dx, dy)
    // The left-hand normal points inside a counter-clockwise ring.
    const [ix, iy] = [(-dy / length) * inward, (dx / length) * inward]
    const half = PARAPET_THICKNESS_M / 2
    const mx = (x + nx) / 2 + ix * half - cx
    const my = (y + ny) / 2 + iy * half - cy
    return new BoxGeometry(length, PARAPET_HEIGHT_M, PARAPET_THICKNESS_M)
      .toNonIndexed()
      .rotateY(Math.atan2(dy, dx))
      .translate(mx, roofHeight + PARAPET_HEIGHT_M / 2, -my)
  })
}
