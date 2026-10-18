import { BoxGeometry, ExtrudeGeometry, Path, PlaneGeometry, Shape, Vector2, type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Design, DesignLevel } from '@contracts/types'
import type { MaterialKey } from './materials'
import type { Block, FacadeModel, Opening } from './types'

// Turns a facade model (types.ts) into geometry, one group per level of designs.json, so each floor
// still drops in on its own (MASTERSPEC 6.3 step 5). Everything is split at the floor datums; each
// level's geometry is merged into one mesh per material.
//
// A level's frame: x = u - width / 2, y = z - the level's base, z = length / 2 - v. Its origin is
// the middle of the footprint at the level's base, so a floor squashes about its own centre.

const WALL_T = 0.2
/** The floor plate that closes a level cut at a datum, so a floor in the air is not hollow. */
const PLATE_T = 0.25
/** A wall rising at most this far above a floor or roof datum is a parapet round a terrace or a roof. */
const RIM_MAX_M = 0.9
const EDGE_CLEAR_M = 0.02
const MIN_OPENING_M = 0.1
const FRAME = { width: 0.05, out0: -0.15, out1: -0.05 }
const GLASS = { out0: -0.12, out1: -0.1 }
const LEAF = { out0: -0.13, out1: -0.08 }
const SILL = { overhang: 0.03, height: 0.03, out0: -0.06, out1: 0.05 }
const JULIET = { height: 1.07, rail: 0.04, picket: 0.018, spacing: 0.11, bottom: 0.08, out0: 0.03, out1: 0.07 }
const GUARD = { rail: 0.045, picket: 0.02, spacing: 0.11, bottom: 0.1 }
const COPING = { height: 0.05, overhang: 0.03 }
const STAIR = { rise: 0.18, tread: 0.04, nosing: 0.03, stringer: 0.04, stringerDepth: 0.25 }
const LIFT = { post: 0.07, platform: 0.08, guard: 1.07 }
const DOWNSPOUT_M = 0.08
const PIT = { wall: 0.2, curb: 0.15, floor: 0.15, lid: 0.12 }

type FaceName = 'front' | 'rear' | 'left' | 'right'
const FACES: FaceName[] = ['front', 'rear', 'left', 'right']

export interface BuiltPart {
  key: MaterialKey
  geometry: BufferGeometry
  /**
   * Draw order: the basement and its walkout draw first (-2), then the walkout's depth-only lid
   * (-1), then the ground and everything else (0). The lid keeps the ground from covering the pit;
   * the ground still covers the rest of the basement below grade.
   */
  order: number
  shadows: boolean
}

export interface BuiltLevel {
  level: DesignLevel
  /** The level's base, above the ground-floor datum. */
  base: number
  /** How far it rises from below when it is the basement. */
  height: number
  parts: BuiltPart[]
}

export interface BuiltFacade {
  width: number
  length: number
  grade: number
  levels: BuiltLevel[]
}

interface Hole {
  s0: number
  s1: number
  h0: number
  h1: number
}

/** Geometry for one level, collected per material in the level's frame. */
class LevelParts {
  readonly parts = new Map<MaterialKey, BufferGeometry[]>()
  readonly width: number
  readonly length: number
  readonly base: number

  constructor(width: number, length: number, base: number) {
    this.width = width
    this.length = length
    this.base = base
  }

  add(key: MaterialKey, geometry: BufferGeometry): void {
    const list = this.parts.get(key) ?? []
    list.push(geometry.index ? geometry.toNonIndexed() : geometry)
    this.parts.set(key, list)
  }

  /** An axis-aligned box from building ranges. */
  box(key: MaterialKey, u0: number, u1: number, v0: number, v1: number, z0: number, z1: number): void {
    const [du, dv, dz] = [Math.abs(u1 - u0), Math.abs(v1 - v0), Math.abs(z1 - z0)]
    if (du < 1e-3 || dv < 1e-3 || dz < 1e-3) return
    this.add(
      key,
      new BoxGeometry(du, dz, dv).translate(
        (u0 + u1) / 2 - this.width / 2,
        (z0 + z1) / 2 - this.base,
        this.length / 2 - (v0 + v1) / 2,
      ),
    )
  }

  /** A box on a block's face: s along the face, h = z, out = metres outward from the outer surface. */
  faceBox(key: MaterialKey, face: FaceName, b: Block, s0: number, s1: number, h0: number, h1: number, out0: number, out1: number): void {
    switch (face) {
      case 'front':
        return this.box(key, s0, s1, b.v0 - out1, b.v0 - out0, h0, h1)
      case 'rear':
        return this.box(key, s0, s1, b.v1 + out0, b.v1 + out1, h0, h1)
      case 'left':
        return this.box(key, b.u0 - out1, b.u0 - out0, s0, s1, h0, h1)
      case 'right':
        return this.box(key, b.u1 + out0, b.u1 + out1, s0, s1, h0, h1)
    }
  }

  /** One wall of a block between z0 and z1, WALL_T thick inside its outer surface, with holes. */
  wall(key: MaterialKey, face: FaceName, b: Block, z0: number, z1: number, holes: Hole[]): void {
    const [a0, a1] = extent(face, b)
    const shape = new Shape([new Vector2(a0, z0), new Vector2(a1, z0), new Vector2(a1, z1), new Vector2(a0, z1)])
    for (const h of holes) {
      // Clockwise, against the outline.
      shape.holes.push(new Path([new Vector2(h.s0, h.h0), new Vector2(h.s0, h.h1), new Vector2(h.s1, h.h1), new Vector2(h.s1, h.h0)]))
    }
    const g = new ExtrudeGeometry(shape, { depth: WALL_T, bevelEnabled: false })
    const { width: w, length: l, base } = this
    switch (face) {
      case 'front':
        g.translate(-w / 2, -base, l / 2 - b.v0 - WALL_T)
        break
      case 'rear':
        g.translate(-w / 2, -base, l / 2 - b.v1)
        break
      case 'left':
        // (s, h, depth) -> (depth, h, -s): s runs along v.
        g.rotateY(Math.PI / 2).translate(b.u0 - w / 2, -base, l / 2)
        break
      case 'right':
        g.rotateY(Math.PI / 2).translate(b.u1 - WALL_T - w / 2, -base, l / 2)
        break
    }
    this.add(key, g)
  }

  /** A box along a plan segment (u, v), from z0 to z1, thick across the segment, shifted sideways. */
  along(key: MaterialKey, p: [number, number], q: [number, number], z0: number, z1: number, thick: number): void {
    const [du, dv] = [q[0] - p[0], q[1] - p[1]]
    const len = Math.hypot(du, dv)
    if (len < 1e-3 || z1 - z0 < 1e-3) return
    const g = new BoxGeometry(len, z1 - z0, thick)
      .translate(len / 2, (z0 + z1) / 2 - this.base, 0)
      .rotateY(Math.atan2(dv, du))
      .translate(p[0] - this.width / 2, 0, this.length / 2 - p[1])
    this.add(key, g)
  }

  merged(order: number): BuiltPart[] {
    const out: BuiltPart[] = []
    for (const [key, list] of this.parts) {
      const geometry = mergeGeometries(list)
      list.forEach((g) => g.dispose())
      if (!geometry) continue
      out.push({ key, geometry, order: key === 'mask' ? -1 : order, shadows: key !== 'mask' && key !== 'glass' })
    }
    return out
  }
}

function extent(face: FaceName, b: Block): [number, number] {
  return face === 'front' || face === 'rear' ? [b.u0, b.u1] : [b.v0, b.v1]
}

/** Where an opening's frame and glass go, clipped to the part of the wall between z0 and z1. */
function clipOpening(o: Opening, face: FaceName, b: Block, z0: number, z1: number): Hole | null {
  const [a0, a1] = extent(face, b)
  const s0 = Math.max(Math.min(o.from, o.to), a0 + EDGE_CLEAR_M)
  const s1 = Math.min(Math.max(o.from, o.to), a1 - EDGE_CLEAR_M)
  const h0 = Math.max(o.sill, z0 + EDGE_CLEAR_M)
  const h1 = Math.min(o.head, z1 - EDGE_CLEAR_M)
  return s1 - s0 >= MIN_OPENING_M && h1 - h0 >= MIN_OPENING_M ? { s0, s1, h0, h1 } : null
}

function overlaps(a: Hole, b: Hole): boolean {
  return a.s0 < b.s1 && b.s0 < a.s1 && a.h0 < b.h1 && b.h0 < a.h1
}

/** A door leaf when the tag says door (D...), glass for windows and glazed doors (W...). */
function isSolidDoor(o: Opening): boolean {
  return o.kind === 'door' && !o.tag.toUpperCase().startsWith('W')
}

function openingDetail(parts: LevelParts, face: FaceName, b: Block, o: Opening, h: Hole): void {
  const f = FRAME.width
  const fill: MaterialKey = isSolidDoor(o) ? 'door' : o.home !== null ? `glass-${o.home}` : 'glass'
  const [out0, out1] = fill === 'door' ? [LEAF.out0, LEAF.out1] : [GLASS.out0, GLASS.out1]
  parts.faceBox(fill, face, b, h.s0, h.s1, h.h0, h.h1, out0, out1)
  // Frame: jambs, head, sill rail, and the transom bar when drawn.
  parts.faceBox('frame', face, b, h.s0, h.s0 + f, h.h0, h.h1, FRAME.out0, FRAME.out1)
  parts.faceBox('frame', face, b, h.s1 - f, h.s1, h.h0, h.h1, FRAME.out0, FRAME.out1)
  parts.faceBox('frame', face, b, h.s0, h.s1, h.h1 - f, h.h1, FRAME.out0, FRAME.out1)
  parts.faceBox('frame', face, b, h.s0, h.s1, h.h0, h.h0 + f, FRAME.out0, FRAME.out1)
  if (o.transom !== undefined && o.transom > h.h0 + f && o.transom < h.h1 - f) {
    parts.faceBox('frame', face, b, h.s0, h.s1, o.transom - f / 2, o.transom + f / 2, FRAME.out0, FRAME.out1)
  }
  if (o.kind === 'window') {
    parts.faceBox('PFM', face, b, h.s0 - SILL.overhang, h.s1 + SILL.overhang, h.h0 - SILL.height, h.h0, SILL.out0, SILL.out1)
  }
  if (o.juliet) {
    const top = Math.min(h.h0 + JULIET.height, h.h1 - JULIET.rail)
    const bottom = h.h0 + JULIET.bottom
    parts.faceBox('metal', face, b, h.s0, h.s1, top - JULIET.rail, top, JULIET.out0, JULIET.out1)
    parts.faceBox('metal', face, b, h.s0, h.s1, bottom, bottom + JULIET.rail, JULIET.out0, JULIET.out1)
    const count = Math.max(1, Math.floor((h.s1 - h.s0) / JULIET.spacing))
    for (let i = 1; i < count; i++) {
      const s = h.s0 + ((h.s1 - h.s0) * i) / count
      parts.faceBox('metal', face, b, s - JULIET.picket / 2, s + JULIET.picket / 2, bottom, top, JULIET.out0 + 0.01, JULIET.out1 - 0.01)
    }
  }
}

export function buildFacade(model: FacadeModel, design: Design): BuiltFacade {
  const { datums: d, width, length } = model
  const sorted = [...design.levels].sort((a, b) => a.level - b.level)
  // Each level's band of z, from designs.json's order: basement, ground, second, third.
  const floors = [d.basement, d.ground, d.second, d.third]
  const bands = sorted.map((level, i) => ({
    level,
    low: floors[i] ?? d.third,
    high: i + 1 < sorted.length ? (floors[i + 1] ?? Infinity) : Infinity,
  }))
  const levels = bands.map((band) => new LevelParts(width, length, band.low))
  const bandOf = (z: number) => {
    const i = bands.findIndex((b) => z >= b.low && z < b.high)
    return i >= 0 ? i : z < bands[0].low ? 0 : bands.length - 1
  }
  /** The floor or roof a wall top rises just above, when it is a parapet. */
  const rimFloor = (top: number) =>
    [d.ground, d.second, d.third, d.roof].filter((z) => z < top - 0.01 && z > top - RIM_MAX_M).sort((a, b) => b - a)[0]

  for (const b of model.blocks) {
    bands.forEach((band, i) => {
      const z0 = Math.max(b.z0, band.low)
      const z1 = Math.min(b.z1, band.high)
      if (z1 - z0 < 0.01) return
      const parts = levels[i]
      for (const face of FACES) {
        const spec = b[face]
        const holes: Hole[] = []
        for (const o of spec?.openings ?? []) {
          const hole = clipOpening(o, face, b, z0, z1)
          if (!hole || holes.some((h) => overlaps(h, hole))) continue
          holes.push(hole)
          openingDetail(parts, face, b, o, hole)
        }
        parts.wall(spec?.cladding ?? b.cladding, face, b, z0, z1, holes)
      }
      // Plates and roofs sit inside the walls, so their edges never show as bands on the facade.
      const t = Math.min(WALL_T, (b.u1 - b.u0) / 2 - 0.01, (b.v1 - b.v0) / 2 - 0.01)
      const inside = (key: MaterialKey, top: number) => {
        if (t > 0) parts.box(key, b.u0 + t, b.u1 - t, b.v0 + t, b.v1 - t, top - PLATE_T, top)
      }
      if (z1 < b.z1 - 0.01) {
        inside('slab', z1)
        return
      }
      inside(b.cap ? 'roof' : 'deck', rimFloor(b.z1) ?? b.z1)
      if (b.cap) {
        const o = COPING.overhang
        const t = WALL_T + o
        const top = [b.z1, b.z1 + COPING.height] as const
        parts.box('PFM', b.u0 - o, b.u1 + o, b.v0 - o, b.v0 - o + t, ...top)
        parts.box('PFM', b.u0 - o, b.u1 + o, b.v1 + o - t, b.v1 + o, ...top)
        parts.box('PFM', b.u0 - o, b.u0 - o + t, b.v0 - o, b.v1 + o, ...top)
        parts.box('PFM', b.u1 + o - t, b.u1 + o, b.v0 - o, b.v1 + o, ...top)
      }
    })
  }

  for (const s of model.slabs) {
    const key: MaterialKey = s.kind === 'canopy' ? 'PFM' : s.kind === 'landing' ? 'galv' : s.kind === 'deck' ? 'deck' : 'slab'
    levels[bandOf(s.z - s.thickness / 2)].box(key, s.u0, s.u1, s.v0, s.v1, s.z - s.thickness, s.z)
  }

  for (const g of model.guards) {
    const parts = levels[bandOf(g.z + 0.01)]
    const top = g.z + g.height
    g.points.forEach((p, i) => {
      parts.box('metal', p[0] - GUARD.rail / 2, p[0] + GUARD.rail / 2, p[1] - GUARD.rail / 2, p[1] + GUARD.rail / 2, g.z, top)
      const q = g.points[i + 1]
      if (!q) return
      parts.along('metal', p, q, top - GUARD.rail, top, GUARD.rail)
      parts.along('metal', p, q, g.z + GUARD.bottom, g.z + GUARD.bottom + GUARD.rail, GUARD.rail)
      const len = Math.hypot(q[0] - p[0], q[1] - p[1])
      const count = Math.max(1, Math.floor(len / GUARD.spacing))
      for (let k = 1; k < count; k++) {
        const t = k / count
        const at: [number, number] = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]
        const h = GUARD.picket / 2
        parts.box('metal', at[0] - h, at[0] + h, at[1] - h, at[1] + h, g.z + GUARD.bottom, top - GUARD.rail)
      }
    })
  }

  for (const st of model.stairs) {
    const [lo, hi] = st.from[2] <= st.to[2] ? [st.from, st.to] : [st.to, st.from]
    const parts = levels[bandOf(hi[2] - 0.01)]
    const rise = hi[2] - lo[2]
    const run = Math.hypot(hi[0] - lo[0], hi[1] - lo[1])
    if (run < 0.05) continue
    const steps = Math.max(1, Math.round(rise / STAIR.rise))
    const dir: [number, number] = [(hi[0] - lo[0]) / run, (hi[1] - lo[1]) / run]
    const side: [number, number] = [-dir[1], dir[0]]
    const at = (t: number, s: number): [number, number] => [lo[0] + dir[0] * t + side[0] * s, lo[1] + dir[1] * t + side[1] * s]
    const half = st.width / 2
    for (let i = 1; i <= steps; i++) {
      const top = lo[2] + (rise * i) / steps
      const t0 = (run * (i - 1)) / steps - STAIR.nosing
      const t1 = (run * i) / steps
      const mid = (t0 + t1) / 2
      // A tread is a box along the stair's line, as long as the stair is wide.
      parts.along('galv', at(mid, -half), at(mid, half), top - STAIR.tread, top, t1 - t0)
    }
    // Stringers: one sloped plate each side, drawn as short steps of plate under the treads.
    for (const s of [-half, half]) {
      for (let i = 1; i <= steps; i++) {
        const top = lo[2] + (rise * i) / steps
        parts.along('galv', at((run * (i - 1)) / steps, s), at((run * i) / steps, s), top - STAIR.stringerDepth, top, STAIR.stringer)
      }
    }
  }

  for (const lift of model.lifts) {
    const parts = levels[bandOf(lift.z0 + 0.01)]
    parts.box('galv', lift.u0, lift.u1, lift.v0, lift.v1, lift.z0, lift.z0 + LIFT.platform)
    const top = lift.z1 + LIFT.guard
    const p = LIFT.post
    for (const [u, v] of [
      [lift.u0, lift.v0],
      [lift.u1 - p, lift.v0],
      [lift.u0, lift.v1 - p],
      [lift.u1 - p, lift.v1 - p],
    ]) {
      parts.box('metal', u, u + p, v, v + p, lift.z0, top)
    }
    parts.box('metal', lift.u0, lift.u1, lift.v0, lift.v0 + p, top - p, top)
    parts.box('metal', lift.u0, lift.u1, lift.v1 - p, lift.v1, top - p, top)
  }

  for (const ds of model.downspouts) {
    const h = DOWNSPOUT_M / 2
    bands.forEach((band, i) => {
      const z0 = Math.max(ds.z0, band.low)
      const z1 = Math.min(ds.z1, band.high)
      if (z1 - z0 > 0.01) levels[i].box('PFM', ds.u - h, ds.u + h, ds.v - h, ds.v + h, z0, z1)
    })
  }

  const basementIndex = bands.findIndex((b) => b.level.level < 0)
  if (basementIndex >= 0) {
    const parts = levels[basementIndex]
    const basementBlocks = model.blocks.filter((b) => b.z0 < d.grade)
    for (const w of model.walkouts) {
      const curb = d.grade + PIT.curb
      parts.box('concrete', w.u0, w.u1, w.v0, w.v1, w.z - PIT.floor, w.z)
      // A retaining wall on each side that is not the basement's own wall.
      const against = {
        front: basementBlocks.some((b) => Math.abs(b.v1 - w.v0) < 0.05 && b.u0 < w.u1 && w.u0 < b.u1),
        rear: basementBlocks.some((b) => Math.abs(b.v0 - w.v1) < 0.05 && b.u0 < w.u1 && w.u0 < b.u1),
        left: basementBlocks.some((b) => Math.abs(b.u1 - w.u0) < 0.05 && b.v0 < w.v1 && w.v0 < b.v1),
        right: basementBlocks.some((b) => Math.abs(b.u0 - w.u1) < 0.05 && b.v0 < w.v1 && w.v0 < b.v1),
      }
      const t = PIT.wall
      if (!against.front) parts.box('concrete', w.u0, w.u1, w.v0, w.v0 + t, w.z, curb)
      if (!against.rear) parts.box('concrete', w.u0, w.u1, w.v1 - t, w.v1, w.z, curb)
      if (!against.left) parts.box('concrete', w.u0, w.u0 + t, w.v0, w.v1, w.z, curb)
      if (!against.right) parts.box('concrete', w.u1 - t, w.u1, w.v0, w.v1, w.z, curb)
      const inner = {
        u0: w.u0 + (against.left ? 0 : t),
        u1: w.u1 - (against.right ? 0 : t),
        v0: w.v0 + (against.front ? 0 : t),
        v1: w.v1 - (against.rear ? 0 : t),
      }
      const lid = new PlaneGeometry(inner.u1 - inner.u0, inner.v1 - inner.v0)
        .rotateX(-Math.PI / 2)
        .translate((inner.u0 + inner.u1) / 2 - width / 2, d.grade + PIT.lid - parts.base, length / 2 - (inner.v0 + inner.v1) / 2)
      parts.add('mask', lid)
    }
  }

  return {
    width,
    length,
    grade: d.grade,
    levels: bands.map((band, i) => ({
      level: band.level,
      base: band.low,
      height: band.high === Infinity ? 0 : band.high - band.low,
      parts: levels[i].merged(band.level.level < 0 ? -2 : 0),
    })),
  }
}
