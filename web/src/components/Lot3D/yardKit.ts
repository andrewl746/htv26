import { BoxGeometry, BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, Vector3 } from 'three'
import type { LocalPoint } from '@contracts/types'

// The pieces of a back garden, shared by the new building's garden (Garden.tsx) and every
// neighbouring house's yard (Yards.tsx), so they all look alike: wooden fences, a shed, a patio with
// a table, chairs and an umbrella, a raised vegetable bed, a flower bed, shrubs and the City's
// bins. A yard is a rectangle behind a house: x runs across it from its middle, y from its rear
// fence toward the house. Pieces are written straight into one geometry with vertex colours (and a
// growth value per vertex), not made as separate meshes: a street has some 80 yards.

export const FENCE = { height: 1.8, panel: 0.05, post: 0.1, postEvery: 2.4, colours: ['#8c6f52', '#7d6248', '#967657', '#73604d'] }
export const SHED = { w: 2.4, d: 1.8, h: 2.1, roof: 0.9, roofColour: '#4b4d52', door: '#3a2f28', colours: ['#7d9a8a', '#a65d4b', '#c9b38a'] }
export const PATIO = { w: 3.0, d: 2.6, stone: '#c8c2b5', furniture: '#f3f1ea', pole: '#6b6b6b', umbrella: ['#2e7d7a', '#c0533e', '#d9a93b'] }
export const BED = { w: 0.7, soil: '#5a4334', frame: '#7a5a3e', leaves: '#5e9a3e', flowers: ['#d94a5a', '#f2c94c', '#8e5cc2', '#f5f0e6', '#e8833a'] }
export const SHRUB = { colours: ['#4f7a3a', '#5d8a43', '#466e35', '#6b9a4c'], radius: [0.45, 0.8] }
/** Toronto's garbage, recycling, green and yard-waste bins. */
const BINS = { w: 0.6, h: 1.05, d: 0.7, colours: ['#55595e', '#2f5aa8', '#3f7d3a'] }

/**
 * A yard's place: the middle of its rear fence, and unit vectors across it and toward the house.
 * toHouse is the right-hand normal of across, as a street frame's `toward` is of its `along`.
 */
export interface YardFrame {
  rear: LocalPoint
  across: LocalPoint
  toHouse: LocalPoint
}

/** A shrub or a flower, drawn as an instanced puff (scale is its radius). */
export interface Plant {
  /** Scene coordinates. */
  x: number
  y: number
  z: number
  scale: number
  colour: Color
  /** The house's distance from the lot, for the ripple; 0 for the new building's garden. */
  distance: number
}

/** A unit shape, non-indexed, centred on the origin: its positions and normals. */
interface Unit {
  position: Float32Array
  normal: Float32Array
}

function unit(geometry: BufferGeometry): Unit {
  const g = geometry.toNonIndexed()
  geometry.dispose()
  const out = { position: Float32Array.from(g.getAttribute('position').array), normal: Float32Array.from(g.getAttribute('normal').array) }
  g.dispose()
  return out
}

const BOX = unit(new BoxGeometry(1, 1, 1))
const ROOF = unit(new ConeGeometry(1, 1, 4))
const CANOPY = unit(new ConeGeometry(1, 1, 8))
const ROD = unit(new CylinderGeometry(1, 1, 1, 6))
const DISC = unit(new CylinderGeometry(1, 1, 1, 16))

const scratch = new Vector3()

/** Writes shapes into growing arrays; geometry() hands them over as one BufferGeometry. */
export class Pieces {
  private position = new Float32Array(3 * 4096)
  private normal = new Float32Array(3 * 4096)
  private colour = new Float32Array(3 * 4096)
  private distance = new Float32Array(4096)
  private count = 0
  private readonly withDistance: boolean
  private readonly colours = new Map<string, Color>()

  constructor(withDistance: boolean) {
    this.withDistance = withDistance
  }

  private room(extra: number): void {
    if (this.count + extra <= this.distance.length) return
    const size = Math.max(this.distance.length * 2, this.count + extra)
    const grow = (a: Float32Array, k: number) => {
      const b = new Float32Array(size * k)
      b.set(a)
      return b
    }
    this.position = grow(this.position, 3)
    this.normal = grow(this.normal, 3)
    this.colour = grow(this.colour, 3)
    this.distance = grow(this.distance, 1)
  }

  private rgb(hex: string): Color {
    let c = this.colours.get(hex)
    if (!c) {
      c = new Color(hex)
      this.colours.set(hex, c)
    }
    return c
  }

  /** A unit shape scaled to sx by sy by sz, turned `angle` about the vertical, standing on `bottom` at a local point. */
  private add(shape: Unit, at: LocalPoint, bottom: number, sx: number, sy: number, sz: number, angle: number, hex: string, distance: number): void {
    const n = shape.position.length / 3
    this.room(n)
    const [c, s] = [Math.cos(angle), Math.sin(angle)]
    const colour = this.rgb(hex)
    const [x0, y0, z0] = [at[0], bottom + sy / 2, -at[1]]
    for (let k = 0; k < n; k++) {
      const v = this.count + k
      const [lx, ly, lz] = [shape.position[3 * k] * sx, shape.position[3 * k + 1] * sy, shape.position[3 * k + 2] * sz]
      this.position[3 * v] = c * lx + s * lz + x0
      this.position[3 * v + 1] = ly + y0
      this.position[3 * v + 2] = -s * lx + c * lz + z0
      // Normals take the inverse scale, then the turn.
      scratch.set(shape.normal[3 * k] / sx, shape.normal[3 * k + 1] / sy, shape.normal[3 * k + 2] / sz).normalize()
      this.normal[3 * v] = c * scratch.x + s * scratch.z
      this.normal[3 * v + 1] = scratch.y
      this.normal[3 * v + 2] = -s * scratch.x + c * scratch.z
      this.colour[3 * v] = colour.r
      this.colour[3 * v + 1] = colour.g
      this.colour[3 * v + 2] = colour.b
      this.distance[v] = distance
    }
    this.count += n
  }

  box(at: LocalPoint, bottom: number, w: number, h: number, d: number, angle: number, hex: string, distance = 0): void {
    this.add(BOX, at, bottom, w, h, d, angle, hex, distance)
  }

  /** A four-sided roof (radius to its corners) or an eight-sided canopy. */
  cone(at: LocalPoint, bottom: number, radius: number, h: number, angle: number, hex: string, sides: 4 | 8, distance = 0): void {
    this.add(sides === 4 ? ROOF : CANOPY, at, bottom, radius, h, radius, angle, hex, distance)
  }

  /** A pole (six-sided) or a round top (sixteen-sided). */
  cylinder(at: LocalPoint, bottom: number, radius: number, h: number, hex: string, round: boolean, distance = 0): void {
    this.add(round ? DISC : ROD, at, bottom, radius, h, radius, 0, hex, distance)
  }

  get empty(): boolean {
    return this.count === 0
  }

  geometry(): BufferGeometry {
    const g = new BufferGeometry()
    const n = this.count
    g.setAttribute('position', new BufferAttribute(this.position.slice(0, 3 * n), 3))
    g.setAttribute('normal', new BufferAttribute(this.normal.slice(0, 3 * n), 3))
    g.setAttribute('color', new BufferAttribute(this.colour.slice(0, 3 * n), 3))
    if (this.withDistance) g.setAttribute(DISTANCE_ATTRIBUTE, new BufferAttribute(this.distance.slice(0, n), 1))
    g.computeBoundingSphere()
    return g
  }
}

/** Each vertex's house distance, for growing the yards in with the ripple on the GPU (Yards.tsx). */
export const DISTANCE_ATTRIBUTE = 'aYardDistance'

/** Places pieces in one yard: local x across from its middle, y from its rear fence toward the house. */
export class YardKit {
  readonly frame: YardFrame
  readonly pieces: Pieces
  readonly plants: Plant[]
  readonly distance: number
  /** Boxes turn with the yard: their width runs across it. */
  readonly angle: number

  constructor(frame: YardFrame, pieces: Pieces, plants: Plant[], distance = 0) {
    this.frame = frame
    this.pieces = pieces
    this.plants = plants
    this.distance = distance
    this.angle = Math.atan2(frame.across[1], frame.across[0])
  }

  at(x: number, y: number): LocalPoint {
    const { rear, across, toHouse } = this.frame
    return [rear[0] + across[0] * x + toHouse[0] * y, rear[1] + across[1] * x + toHouse[1] * y]
  }

  box(x: number, y: number, bottom: number, w: number, h: number, d: number, hex: string, turn = 0): void {
    this.pieces.box(this.at(x, y), bottom, w, h, d, this.angle + turn, hex, this.distance)
  }

  plant(x: number, y: number, up: number, scale: number, colour: Color): void {
    const [e, n] = this.at(x, y)
    this.plants.push({ x: e, y: up, z: -n, scale, colour, distance: this.distance })
  }

  /** A wooden fence from (x0, y0) to (x1, y1), with posts. */
  fence(x0: number, y0: number, x1: number, y1: number, hex: string, height = FENCE.height): void {
    const len = Math.hypot(x1 - x0, y1 - y0)
    if (len < 0.2) return
    const turn = Math.atan2(y1 - y0, x1 - x0)
    // Box width runs across the yard (x); a fence along y turns a quarter.
    const along = (t: number): [number, number] => [x0 + ((x1 - x0) * t) / len, y0 + ((y1 - y0) * t) / len]
    const [mx, my] = along(len / 2)
    this.box(mx, my, 0, len, height, FENCE.panel, hex, -turn)
    for (let t = 0; t <= len + 1e-6; t += FENCE.postEvery) {
      const [px, py] = along(Math.min(t, len))
      this.box(px, py, 0, FENCE.post, height + 0.1, FENCE.post, hex, -turn)
    }
  }

  shed(x: number, y: number, colourIndex: number): void {
    this.box(x, y, 0, SHED.w, SHED.h, SHED.d, SHED.colours[colourIndex % SHED.colours.length])
    this.pieces.cone(this.at(x, y), SHED.h, Math.hypot(SHED.w, SHED.d) / 2 + 0.2, SHED.roof, Math.PI / 4 + this.angle, SHED.roofColour, 4, this.distance)
    // The door, on the side facing the house.
    this.box(x, y, 0, 0.8, 1.8, SHED.d + 0.04, SHED.door)
  }

  /** A patio: stone, a round table, four chairs and an umbrella. */
  patio(x: number, y: number, umbrella: string): void {
    this.box(x, y, 0, PATIO.w, 0.06, PATIO.d, PATIO.stone)
    const centre = this.at(x, y)
    this.pieces.cylinder(centre, 0.725, 0.45, 0.05, PATIO.furniture, true, this.distance)
    this.pieces.cylinder(centre, 0.03, 0.05, 0.72, PATIO.furniture, false, this.distance)
    for (const [dx, dy] of [[0.85, 0], [-0.85, 0], [0, 0.85], [0, -0.85]]) {
      this.box(x + dx, y + dy, 0, 0.45, 0.45, 0.45, PATIO.furniture)
      this.box(x + dx * 1.25, y + dy * 1.25, 0.45, 0.45 * (dx ? 0.12 : 1), 0.5, 0.45 * (dy ? 0.12 : 1), PATIO.furniture)
    }
    this.pieces.cylinder(centre, 0, 0.025, 2.2, PATIO.pole, false, this.distance)
    this.pieces.cone(centre, 1.9, 1.25, 0.5, 0, umbrella, 8, this.distance)
  }

  /** A raised vegetable bed two metres across, with a row of greens. */
  raisedBed(x: number, y: number): void {
    this.box(x, y, 0, 2.0, 0.35, 1.0, BED.frame)
    this.box(x, y, 0.3, 1.9, 0.06, 0.9, BED.soil)
    const leaves = new Color(BED.leaves)
    for (let i = 0; i < 6; i++) this.plant(x - 0.7 + i * 0.28, y, 0.45, 0.18, leaves)
  }

  /** A flower bed along the fence at x, from y0 toward the house to y1, two rows of flowers. */
  flowerBed(x: number, y0: number, y1: number, random: () => number, inward: 1 | -1): void {
    this.box(x, (y0 + y1) / 2, 0, BED.w, 0.12, y1 - y0, BED.soil)
    for (let y = y0 + 0.2; y < y1; y += 0.32) {
      for (const dx of [-0.17, 0.1]) {
        const colour = new Color(BED.flowers[Math.floor(random() * BED.flowers.length)])
        this.plant(x + dx * inward, y + random() * 0.1, 0.22, 0.13 + random() * 0.05, colour)
      }
    }
  }

  /** A shrub whose edge stands at y, its middle a little further in. */
  shrub(x: number, y: number, random: () => number): void {
    const r = SHRUB.radius[0] + random() * (SHRUB.radius[1] - SHRUB.radius[0])
    this.plant(x, y + r * 0.6, r * 0.8, r, new Color(SHRUB.colours[Math.floor(random() * SHRUB.colours.length)]))
  }

  /** The bins in a row against the fence at x, near the house. */
  bins(x: number, y: number, inward: 1 | -1): void {
    BINS.colours.forEach((hex, i) => this.box(x + inward * (BINS.d / 2 + 0.1), y - i * (BINS.w + 0.08), 0, BINS.d, BINS.h, BINS.w, hex))
  }
}
