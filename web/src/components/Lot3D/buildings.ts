import {
  Box3,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Sphere,
  Vector3,
  type Object3D,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { ContextBuilding, LocalPoint } from '@contracts/types'
import { SLOT_ATTRIBUTE } from './cutaway'
import { openRing, seededIndex, shapeFrom, signedArea, vertexMean } from './geometry'
import { frontEdge, houseDetails } from './houseDetails'
import { HOUSE_STYLE } from './houseStyle'
import type { Look } from './look'
import type { Box } from './occlusion'
import { towardStreet, type StreetFrame } from './streetFrame'
import { ease, lerp } from './timeline'

// Neighbouring buildings (MASTERSPEC 6.3 step 2): houses get a gable roof with the ridge along the
// footprint's long axis; large buildings stay flat with a parapet. Roofs are squared up to the
// street's grid, so a row of houses reads as parallel roofs rather than a scatter of angles.
//
// Each building is a few parts, each drawn with its slot's material: its walls (by its colour
// index), its pitched roof, its flat roof. The classic look keeps the original two parts (walls with
// the parapet, the roof prism); the drawn look (A15) splits the walls from their caps so the roofs
// never wear the facade texture, gives the pitched roofs shingle UVs and a seeded tint, and puts the
// gable ends with the walls.
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
/**
 * A footprint that fills less of its squared-up box than this (an L, a U, a notch or a cut corner)
 * gets its pitched roof over its largest rectangle only, and flat roofs over the rest: a roof over
 * the whole box would hang over the notch with its gable floating in the air.
 */
const FILLED_BOX = 0.9
/** Footprint corners this close across the box are one grid line when finding that rectangle. */
const GRID_SNAP_M = 0.35
const MAX_GRID_LINES = 40
/** A largest rectangle under this share of the footprint is no main body: the house is flat-roofed. */
const MIN_PITCHED_SHARE = 0.55
const PARAPET_HEIGHT_M = 0.5
const PARAPET_THICKNESS_M = 0.3
/** Buildings start a little narrower than their footprint while they grow up. */
const GROW_START_WIDTH = 0.85
/** Drawn look: shingle tints, multiplied over the shingle texture, picked per building. */
const ROOF_TINTS = ['#5b5d61', '#6a5648', '#4a4d52', '#7a6556', '#56504a']
/** Drawn look: a brick chimney on some houses, near one gable end, standing above the ridge. */
const CHIMNEY = { size: 0.6, aboveRidgeM: 0.8, fromGableM: 1.2, offRidgeM: 0.4, outOfFive: 3 }

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

/**
 * Which material a part takes: the walls of its colour, the pitched roof, the flat roof, and in
 * the drawn look the windows' glass, the white trim (frames, sills, porches) and the front doors.
 */
export type PartSlot = 'wall' | 'roof' | 'flat' | 'glass' | 'trim' | 'door'
const SHARED_SLOTS: PartSlot[] = ['roof', 'flat', 'glass', 'trim', 'door']

export interface BuildingPart {
  slot: PartSlot
  geometry: BufferGeometry
}

export interface BuiltBuilding {
  /** The massing id. Not unique: the parts of a polygon cut by the lot line share it, and its colour. */
  id: number
  /** Base centre in scene x and z; the geometries sit around it so the building can grow in place. */
  x: number
  z: number
  distance: number
  colorIndex: number
  parts: BuildingPart[]
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

export function buildBuilding(building: ContextBuilding, grid: StreetGrid, look: Look, street: StreetFrame | null = null): BuiltBuilding {
  const ring = openRing(building.footprint_local)
  const centre = vertexMean(ring)
  const [cx, cy] = centre
  const height = building.avg_height_m

  const walls = new ExtrudeGeometry(shapeFrom(ring), { depth: height, bevelEnabled: false }).rotateX(-Math.PI / 2)
  walls.translate(-cx, 0, cy)

  const parts: BuildingPart[] = []
  const plan = building.kind === 'house' ? roofPlan(ring, centre, grid) : null
  if (look === 'classic') {
    if (plan && !plan.flat) {
      // The walls keep their top cap, which shows where the roof does not reach.
      parts.push({ slot: 'wall', geometry: walls }, { slot: 'roof', geometry: gableRoof(plan, height) })
    } else {
      parts.push({ slot: 'wall', geometry: merged([walls, ...parapet(ring, centre, height)]) })
    }
  } else {
    const { caps, sides } = splitExtrude(walls)
    walls.dispose()
    const house = building.kind === 'house'
    const details = houseDetails({
      ring,
      centre,
      wallHeight: height,
      large: !house,
      front: house ? frontEdge(ring, towardStreet(street, centre)) : null,
      style: HOUSE_STYLE,
      seed: seededIndex(building.building_id + 37, 997),
    })
    const extraWalls = details.wall.map(metreUVs)
    if (plan && !plan.flat) {
      const tint = ROOF_TINTS[seededIndex(building.building_id + 101, ROOF_TINTS.length)]
      const roof = pitchedRoof(plan, height, tint)
      if (HOUSE_STYLE.chimney && seededIndex(building.building_id + 53, 5) < CHIMNEY.outOfFive) {
        extraWalls.push(metreUVs(chimney(plan, height)))
      }
      parts.push({ slot: 'wall', geometry: merged([sides, roof.gables, ...extraWalls]) }, { slot: 'roof', geometry: roof.slopes })
      // The top cap hides under a roof over the whole footprint; beside a partial one it is the
      // flat roof of the wings.
      if (plan.partial) parts.push({ slot: 'flat', geometry: caps })
      else caps.dispose()
    } else if (plan) {
      // No main body to pitch a roof over: a flat roof, with a low parapet like a flat-roofed house.
      parts.push({ slot: 'wall', geometry: merged([sides, ...extraWalls]) }, { slot: 'flat', geometry: merged([caps, ...parapet(ring, centre, height)]) })
    } else {
      parts.push(
        { slot: 'wall', geometry: merged([sides, ...extraWalls]) },
        { slot: 'flat', geometry: merged([caps, ...parapet(ring, centre, height)]) },
      )
    }
    if (details.glass.length) parts.push({ slot: 'glass', geometry: merged(details.glass) })
    if (details.trim.length) parts.push({ slot: 'trim', geometry: merged(details.trim) })
    if (details.door.length) parts.push({ slot: 'door', geometry: merged(details.door) })
  }

  return {
    id: building.building_id,
    x: cx,
    z: -cy,
    distance: Math.hypot(cx, cy),
    colorIndex: seededIndex(building.building_id, NEIGHBOUR_TOKENS.length),
    parts,
    box: boxOf(ring, centre, grid, buildingTop(building)),
  }
}

/** Tags every vertex of a building with its slot in the cutaway's sink texture (before merging). */
export function setSlot(built: BuiltBuilding, slot: number): void {
  for (const { geometry } of built.parts) {
    const slots = new Float32Array(geometry.getAttribute('position').count).fill(slot)
    geometry.setAttribute(SLOT_ATTRIBUTE, new Float32BufferAttribute(slots, 1))
  }
}

export function disposeBuilt(built: BuiltBuilding[]): void {
  for (const b of built) b.parts.forEach((p) => p.geometry.dispose())
}

/** Merges and disposes the inputs; one geometry stays as it is. */
function merged(geometries: BufferGeometry[]): BufferGeometry {
  if (geometries.length === 1) return geometries[0]
  const out = mergeGeometries(geometries)
  if (!out) return geometries[0]
  geometries.forEach((g) => g.dispose())
  return out
}

export interface MergedStreet {
  /** One per wall colour. */
  walls: (BufferGeometry | null)[]
  /** One for each other slot: pitched roofs, flat roofs, glass, trim, doors. */
  shared: { slot: PartSlot; geometry: BufferGeometry }[]
}

export function disposeMerged(merged: MergedStreet): void {
  for (const g of [...merged.walls, ...merged.shared.map((p) => p.geometry)]) g?.dispose()
}

/**
 * One geometry per wall colour and one per other slot, for the whole street (after the ripple).
 * A generator that yields after each building part, so the merge runs in short slices between frames
 * while the street grows: done at once, a full street took one frame of about 0.2 s on the demo
 * laptop. Each part is copied straight into the merged arrays at its building's place, without
 * cloning and moving it first. Returns null, and the street stays as it grew, if a slot's parts
 * have different attributes (mergeGeometries would refuse them too).
 */
export function* mergeStreet(built: BuiltBuilding[]): Generator<void, MergedStreet | null> {
  const of = (slot: PartSlot, keep: (b: BuiltBuilding) => boolean): Placed[] =>
    built.flatMap((b) => (keep(b) ? b.parts.filter((p) => p.slot === slot).map((p) => ({ geometry: p.geometry, x: b.x, z: b.z })) : []))
  const merged: MergedStreet = { walls: [], shared: [] }
  for (let i = 0; i < NEIGHBOUR_TOKENS.length; i++) {
    const geometry = yield* mergePlaced(of('wall', (b) => b.colorIndex === i))
    if (geometry === 'mismatch') return abandon(merged)
    merged.walls.push(geometry)
  }
  for (const slot of SHARED_SLOTS) {
    const geometry = yield* mergePlaced(of(slot, () => true))
    if (geometry === 'mismatch') return abandon(merged)
    if (geometry) merged.shared.push({ slot, geometry })
  }
  return merged
}

function abandon(merged: MergedStreet): null {
  disposeMerged(merged)
  return null
}

/** A building part and where its building stands. */
interface Placed {
  geometry: BufferGeometry
  x: number
  z: number
}

/**
 * The parts moved to their places and merged into one geometry, its bounds already set, so its
 * first frame does not compute them; null without parts. Yields after each part.
 */
function* mergePlaced(parts: Placed[]): Generator<void, BufferGeometry | null | 'mismatch'> {
  if (parts.length === 0) return null
  const first = parts[0].geometry
  const names = Object.keys(first.attributes)
  const indexed = first.index !== null
  let vertices = 0
  let indices = 0
  for (const { geometry } of parts) {
    if ((geometry.index !== null) !== indexed || Object.keys(geometry.attributes).length !== names.length) return 'mismatch'
    for (const name of names) {
      const [a, f] = [geometry.attributes[name], first.attributes[name]]
      if (!(a instanceof BufferAttribute) || !(f instanceof BufferAttribute)) return 'mismatch'
      if (a.itemSize !== f.itemSize || a.normalized !== f.normalized || a.array.constructor !== f.array.constructor) return 'mismatch'
    }
    vertices += geometry.attributes.position.count
    indices += geometry.index?.count ?? 0
  }

  const out = names.map((name) => {
    const f = first.attributes[name] as BufferAttribute
    const array = new (f.array.constructor as new (length: number) => typeof f.array)(vertices * f.itemSize)
    return { name, array, itemSize: f.itemSize, normalized: f.normalized }
  })
  const position = out.find((o) => o.name === 'position')!.array
  const index = indexed ? new Uint32Array(indices) : null
  const box = new Box3()
  let v = 0
  let k = 0
  for (const { geometry, x, z } of parts) {
    const count = geometry.attributes.position.count
    for (const o of out) o.array.set((geometry.attributes[o.name] as BufferAttribute).array, v * o.itemSize)
    for (let i = v * 3; i < (v + count) * 3; i += 3) {
      position[i] += x
      position[i + 2] += z
      box.expandByPoint(scratchPoint.set(position[i], position[i + 1], position[i + 2]))
    }
    if (index && geometry.index) {
      const source = geometry.index.array
      for (let j = 0; j < source.length; j++) index[k + j] = source[j] + v
      k += source.length
    }
    v += count
    yield
  }

  const geometry = new BufferGeometry()
  for (const o of out) geometry.setAttribute(o.name, new BufferAttribute(o.array, o.itemSize, o.normalized))
  if (index) geometry.setIndex(new BufferAttribute(index, 1))
  geometry.boundingBox = box
  geometry.boundingSphere = box.getBoundingSphere(new Sphere())
  return geometry
}

const scratchPoint = new Vector3()

/**
 * UVs in metres for a box, like the extruded walls have, so a bay or a chimney wears its brick at
 * the wall's scale: each face is projected onto the two axes across it, v = 1 - height on the sides.
 */
function metreUVs(geometry: BufferGeometry): BufferGeometry {
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const uv = new Float32Array(position.count * 2)
  const n = new Vector3()
  for (let i = 0; i < position.count; i++) {
    n.fromBufferAttribute(normal, i)
    const [x, y, z] = [position.getX(i), position.getY(i), position.getZ(i)]
    const [ax, ay, az] = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)]
    const [u, v] = ay >= ax && ay >= az ? [x, z] : ax >= az ? [z, 1 - y] : [x, 1 - y]
    uv[2 * i] = u
    uv[2 * i + 1] = v
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  return geometry
}

/** A brick chimney near one gable end, just off the ridge, rising above it. */
function chimney(plan: RoofPlan, wallHeight: number): BufferGeometry {
  const { a, b, a0, bm, rise } = roofFrame(plan)
  const along = a0 + CHIMNEY.fromGableM
  const across = bm + CHIMNEY.offRidgeM
  const x = a[0] * along + b[0] * across
  const y = a[1] * along + b[1] * across
  const bottom = wallHeight + rise * 0.4
  const top = wallHeight + rise + CHIMNEY.aboveRidgeM
  return new BoxGeometry(CHIMNEY.size, top - bottom, CHIMNEY.size)
    .toNonIndexed()
    .rotateY(Math.atan2(a[1], a[0]))
    .translate(x, (top + bottom) / 2, -y)
}

/** An ExtrudeGeometry's caps (its group 0) and side walls (group 1) as two geometries. */
function splitExtrude(geometry: ExtrudeGeometry): { caps: BufferGeometry; sides: BufferGeometry } {
  const pick = (materialIndex: number) => {
    const ranges = geometry.groups.filter((g) => g.materialIndex === materialIndex)
    const out = new BufferGeometry()
    for (const name of ['position', 'normal', 'uv']) {
      const attribute = geometry.getAttribute(name)
      const size = attribute.itemSize
      const source = attribute.array as Float32Array
      const array = new Float32Array(ranges.reduce((n, r) => n + r.count, 0) * size)
      let offset = 0
      for (const r of ranges) {
        array.set(source.subarray(r.start * size, (r.start + r.count) * size), offset)
        offset += r.count * size
      }
      out.setAttribute(name, new Float32BufferAttribute(array, size))
    }
    return out
  }
  return { caps: pick(0), sides: pick(1) }
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

/**
 * Where a house's pitched roof goes: a rectangle in the squared-up frame (axis a along the ridge, b
 * counter-clockwise of it, extents ea and eb from the footprint's centre). It is the whole box when
 * the footprint fills it; otherwise the largest rectangle inside the footprint, the rest flat-roofed
 * (partial); and when even that rectangle is a small part of the footprint, no pitched roof (flat).
 */
interface RoofPlan {
  a: LocalPoint
  b: LocalPoint
  ea: [number, number]
  eb: [number, number]
  partial: boolean
  flat: boolean
}

function roofPlan(ring: LocalPoint[], centre: LocalPoint, grid: StreetGrid): RoofPlan {
  const box = squaredBox(ring, centre, grid)
  const whole: RoofPlan = { a: box.a, b: box.b, ea: box.ea, eb: box.eb, partial: false, flat: false }
  const area = Math.abs(signedArea(ring))
  if (area >= FILLED_BOX * (box.ea[1] - box.ea[0]) * (box.eb[1] - box.eb[0])) return whole
  const rect = largestRectangle(ring, centre, box.a, box.b)
  if (!rect || rect.area < MIN_PITCHED_SHARE * area) return { ...whole, partial: true, flat: true }
  // The ridge runs along the rectangle's long side, or the box's way when it is about square.
  const [along, across] = [rect.ea[1] - rect.ea[0], rect.eb[1] - rect.eb[0]]
  if (across > SQUARE_ASPECT * along) {
    return { a: box.b, b: [-box.a[0], -box.a[1]], ea: rect.eb, eb: [-rect.ea[1], -rect.ea[0]], partial: true, flat: false }
  }
  return { a: box.a, b: box.b, ea: rect.ea, eb: rect.eb, partial: true, flat: false }
}

/** Sorted coordinates, those within GRID_SNAP_M of each other merged; the outermost kept exact. */
function gridLines(values: number[]): number[] {
  const sorted = [...values].sort((p, q) => p - q)
  const groups: number[][] = []
  for (const v of sorted) {
    const last = groups.at(-1)
    if (last && v - last[last.length - 1] <= GRID_SNAP_M) last.push(v)
    else groups.push([v])
  }
  return groups.map((g, i) => (i === 0 ? g[0] : i === groups.length - 1 ? g[g.length - 1] : g.reduce((s, v) => s + v, 0) / g.length))
}

/** Ray-casting point-in-polygon test. */
function insideRing([x, y]: LocalPoint, ring: LocalPoint[]): boolean {
  let hit = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

/**
 * The largest rectangle, square to axes a and b, inside the footprint: the footprint's corners make
 * a grid in that frame, each cell is in or out by its middle, and every block of whole cells is tried.
 */
function largestRectangle(
  ring: LocalPoint[],
  [cx, cy]: LocalPoint,
  a: LocalPoint,
  b: LocalPoint,
): { ea: [number, number]; eb: [number, number]; area: number } | null {
  const pts: LocalPoint[] = ring.map(([x, y]) => [(x - cx) * a[0] + (y - cy) * a[1], (x - cx) * b[0] + (y - cy) * b[1]])
  const us = gridLines(pts.map((p) => p[0]))
  const vs = gridLines(pts.map((p) => p[1]))
  if (us.length < 2 || vs.length < 2 || us.length > MAX_GRID_LINES || vs.length > MAX_GRID_LINES) return null
  // Inside-cell counts summed from the corner, so a block's count is four lookups.
  const w = vs.length
  const sum = new Int32Array(us.length * w)
  for (let i = 1; i < us.length; i++) {
    for (let j = 1; j < vs.length; j++) {
      const inside = insideRing([(us[i - 1] + us[i]) / 2, (vs[j - 1] + vs[j]) / 2], pts) ? 1 : 0
      sum[i * w + j] = inside + sum[(i - 1) * w + j] + sum[i * w + j - 1] - sum[(i - 1) * w + j - 1]
    }
  }
  let best: { ea: [number, number]; eb: [number, number]; area: number } | null = null
  for (let i0 = 0; i0 < us.length - 1; i0++) {
    for (let i1 = i0 + 1; i1 < us.length; i1++) {
      for (let j0 = 0; j0 < vs.length - 1; j0++) {
        for (let j1 = j0 + 1; j1 < vs.length; j1++) {
          const cells = sum[i1 * w + j1] - sum[i0 * w + j1] - sum[i1 * w + j0] + sum[i0 * w + j0]
          if (cells !== (i1 - i0) * (j1 - j0)) break
          const area = (us[i1] - us[i0]) * (vs[j1] - vs[j0])
          if (!best || area > best.area) best = { ea: [us[i0], us[i1]], eb: [vs[j0], vs[j1]], area }
        }
      }
    }
  }
  return best
}

/** The roof's frame: its rectangle with the gable overhang, and the ridge's rise. */
function roofFrame({ a, b, ea, eb }: RoofPlan) {
  const o = GABLE_OVERHANG_M
  const [a0, a1] = [ea[0] - o, ea[1] + o]
  const [b0, b1] = eb
  const rise = Math.min(ROOF_RIDGE_MAX_M, ((b1 - b0) / 2) * Math.tan((ROOF_PITCH_DEG * Math.PI) / 180))
  return { a, b, a0, a1, b0, b1, bm: (b0 + b1) / 2, rise }
}

/** A triangular prism over the roof plan's rectangle, its ridge along axis a. */
function gableRoof(plan: RoofPlan, wallHeight: number): BufferGeometry {
  const { a, b, a0, a1, b0, b1, bm, rise } = roofFrame(plan)
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

/**
 * The drawn look's roof: the same prism, its slopes with shingle UVs in metres (u along the ridge,
 * v up the slope) and a tint as vertex colour, and its gable ends with wall UVs (v = 1 - height,
 * as the extruded walls have) so they wear the wall's texture.
 */
function pitchedRoof(plan: RoofPlan, wallHeight: number, tint: string): { slopes: BufferGeometry; gables: BufferGeometry } {
  const { a, b, a0, a1, b0, b1, bm, rise } = roofFrame(plan)
  const at = (u: number, v: number, up: number) => [u * a[0] + v * b[0], up, -(u * a[1] + v * b[1])]
  const h = wallHeight
  const slope = Math.hypot((b1 - b0) / 2, rise)
  const e0a = at(a0, b0, h)
  const e0b = at(a1, b0, h)
  const e1a = at(a0, b1, h)
  const e1b = at(a1, b1, h)
  const ra = at(a0, bm, h + rise)
  const rb = at(a1, bm, h + rise)

  const slopeTriangles = [
    [e0a, e0b, rb], [e0a, rb, ra],
    [e1b, e1a, ra], [e1b, ra, rb],
  ]
  const slopeUv = [
    [[a0, 0], [a1, 0], [a1, slope]], [[a0, 0], [a1, slope], [a0, slope]],
    [[a1, 0], [a0, 0], [a0, slope]], [[a1, 0], [a0, slope], [a1, slope]],
  ]
  const slopes = new BufferGeometry()
  slopes.setAttribute('position', new Float32BufferAttribute(slopeTriangles.flat(2), 3))
  slopes.setAttribute('uv', new Float32BufferAttribute(slopeUv.flat(2), 2))
  const colour = new Color(tint)
  slopes.setAttribute('color', new Float32BufferAttribute(new Array(12).fill([colour.r, colour.g, colour.b]).flat(), 3))
  slopes.computeVertexNormals()

  const gableTriangles = [
    [e0a, ra, e1a],
    [e0b, e1b, rb],
  ]
  const gableUv = [
    [[b0, 1 - h], [bm, 1 - h - rise], [b1, 1 - h]],
    [[b0, 1 - h], [b1, 1 - h], [bm, 1 - h - rise]],
  ]
  const gables = new BufferGeometry()
  gables.setAttribute('position', new Float32BufferAttribute(gableTriangles.flat(2), 3))
  gables.setAttribute('uv', new Float32BufferAttribute(gableUv.flat(2), 2))
  gables.computeVertexNormals()
  return { slopes, gables }
}

/** One thin box along each edge, just inside it, standing on the roof. */
function parapet(ring: LocalPoint[], [cx, cy]: LocalPoint, roofHeight: number): BufferGeometry[] {
  const inward = signedArea(ring) > 0 ? 1 : -1
  return ring.flatMap(([x, y], i) => {
    const [nx, ny] = ring[(i + 1) % ring.length]
    const [dx, dy] = [nx - x, ny - y]
    const length = Math.hypot(dx, dy)
    // Some of the City's footprints repeat a corner: that edge has no length and so no normal, and
    // its box would land at NaN (building 141978, beside 100 Queen St W).
    if (length === 0) return []
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
