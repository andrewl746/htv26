import { BoxGeometry, BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, type Object3D } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { ContextBuilding, LocalPoint } from '@contracts/types'
import { openRing, seededIndex, shapeFrom, signedArea, vertexMean } from './geometry'
import { ease, lerp } from './timeline'

// Neighbouring buildings (MASTERSPEC 6.3 step 2): houses get a cartoon gable roof with the ridge
// along the footprint's long axis; large buildings stay flat with a parapet.
const ROOF_PITCH_DEG = 30
const ROOF_RIDGE_MAX_M = 2.5
const ROOF_OVERHANG_M = 0.3
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
}

export function buildBuilding(building: ContextBuilding): BuiltBuilding {
  const ring = openRing(building.footprint_local)
  const [cx, cy] = vertexMean(ring)
  const height = building.avg_height_m

  const walls = new ExtrudeGeometry(shapeFrom(ring), { depth: height, bevelEnabled: false }).rotateX(-Math.PI / 2)
  walls.translate(-cx, 0, cy)

  let body: BufferGeometry = walls
  let roof: BufferGeometry | null = null
  if (building.kind === 'house') {
    roof = gableRoof(ring, [cx, cy], height)
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

/**
 * A triangular prism over the footprint's oriented bounding box. The long axis comes from the
 * vertices' principal direction, which is exact for the rectangles most house footprints are.
 */
function gableRoof(ring: LocalPoint[], [cx, cy]: LocalPoint, wallHeight: number): BufferGeometry {
  let sxx = 0
  let syy = 0
  let sxy = 0
  for (const [x, y] of ring) {
    sxx += (x - cx) ** 2
    syy += (y - cy) ** 2
    sxy += (x - cx) * (y - cy)
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy)
  let a: LocalPoint = [Math.cos(angle), Math.sin(angle)]
  let b: LocalPoint = [-a[1], a[0]]
  const extent = (axis: LocalPoint) => {
    const values = ring.map(([x, y]) => (x - cx) * axis[0] + (y - cy) * axis[1])
    return [Math.min(...values), Math.max(...values)]
  }
  if (extent(a)[1] - extent(a)[0] < extent(b)[1] - extent(b)[0]) {
    // Turn both axes a quarter so the ridge runs along the longer side and b stays counter-clockwise of a.
    ;[a, b] = [b, [-b[0], -b[1]]]
  }
  const o = ROOF_OVERHANG_M
  const [a0, a1] = extent(a).map((v, i) => (i === 0 ? v - o : v + o))
  const [b0, b1] = extent(b).map((v, i) => (i === 0 ? v - o : v + o))
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
