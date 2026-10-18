import { BoxGeometry, BufferAttribute, BufferGeometry, Color } from 'three'
import type { LocalPoint } from '@contracts/types'
import { signedArea } from './geometry'
import type { HouseStyle } from './houseStyle'

// The details on a neighbour's walls (drawn look): windows on every full floor of every wall long
// enough for one, set below the eaves so none runs into a gable or a roof; on a house, a front
// door with a porch on the wall facing the street, and a bay window when the style has one.
// Everything is built around the building's base centre, like its walls, so it grows and sinks
// with the building. A street has some 25,000 of these boxes, so they are written straight into
// one geometry per slot rather than made as BoxGeometry, turned, moved and merged one by one,
// which took half a second on the demo laptop as an address opened.

const HOUSE = { floorM: 2.9, sillM: 0.9, windowW: 0.95, windowH: 1.45, spacingM: 2.3, insetM: 0.85, eaveClearM: 0.35, minEdgeM: 2.2 }
const LARGE = { floorM: 3.0, sillM: 0.9, windowW: 1.25, windowH: 1.6, spacingM: 2.6, insetM: 1.0, eaveClearM: 0.5, minEdgeM: 2.6 }
const FRAME = { border: 0.08, depth: 0.05, out: 0.025 }
const GLASS = { depth: 0.02, out: 0.06 }
const SILL = { overhang: 0.1, height: 0.06, depth: 0.14, out: 0.07 }
const DOOR = { w: 0.95, h: 2.15, bottom: 0.25, out: 0.04 }
const PORCH = { width: 2.1, depth: 1.5, height: 2.6, thick: 0.14, post: 0.12, step: { w: 1.4, h: 0.25, d: 0.5 } }
const BAY = { width: 2.5, depth: 0.75, height: 2.75, minEdgeM: 5.4, windowW: 1.3, sideW: 0.45 }

/** At most one geometry each for the glass, trim and doors. */
export interface Details {
  glass: BufferGeometry[]
  trim: BufferGeometry[]
  door: BufferGeometry[]
  /** Pieces in the wall's own material (the bay window's box). */
  wall: BufferGeometry[]
}

/** A box sized w (along the wall) x h (up) x d (out), turned theta about the vertical, centred at x, y, z. */
interface Box {
  x: number
  y: number
  z: number
  w: number
  h: number
  d: number
  theta: number
}

/** A unit box's 36 corners, normals and uvs in BoxGeometry's order: the boxes keep its exact faces. */
const UNIT = (() => {
  const g = new BoxGeometry(1, 1, 1).toNonIndexed()
  const out = {
    position: Float32Array.from(g.getAttribute('position').array),
    normal: Float32Array.from(g.getAttribute('normal').array),
    uv: Float32Array.from(g.getAttribute('uv').array),
  }
  g.dispose()
  return out
})()
const CORNERS = UNIT.position.length / 3

/** All the boxes as one non-indexed geometry, as merging each one as BoxGeometry().toNonIndexed().rotateY().translate() would. */
function boxGeometry(boxes: Box[], colour: Color | null = null): BufferGeometry {
  const n = boxes.length * CORNERS
  const position = new Float32Array(n * 3)
  const normal = new Float32Array(n * 3)
  const uv = new Float32Array(n * 2)
  const p = UNIT.position
  // The boxes on one wall share its turn, and so their normals.
  const turned = new Float32Array(CORNERS * 3)
  let turnedFor = NaN
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i]
    const c = Math.cos(b.theta)
    const s = Math.sin(b.theta)
    if (b.theta !== turnedFor) {
      turnedFor = b.theta
      for (let k = 0; k < CORNERS; k++) {
        const nx = UNIT.normal[3 * k]
        const nz = UNIT.normal[3 * k + 2]
        turned[3 * k] = c * nx + s * nz
        turned[3 * k + 1] = UNIT.normal[3 * k + 1]
        turned[3 * k + 2] = -s * nx + c * nz
      }
    }
    const v0 = i * CORNERS
    normal.set(turned, 3 * v0)
    uv.set(UNIT.uv, 2 * v0)
    for (let k = 0, o = 3 * v0; k < CORNERS; k++, o += 3) {
      const lx = p[3 * k] * b.w
      const lz = p[3 * k + 2] * b.d
      position[o] = c * lx + s * lz + b.x
      position[o + 1] = p[3 * k + 1] * b.h + b.y
      position[o + 2] = -s * lx + c * lz + b.z
    }
  }
  // BufferAttribute keeps the arrays; Float32BufferAttribute would copy each one.
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(position, 3))
  geometry.setAttribute('normal', new BufferAttribute(normal, 3))
  geometry.setAttribute('uv', new BufferAttribute(uv, 2))
  if (colour) {
    const colours = new Float32Array(n * 3)
    for (let i = 0; i < colours.length; i += 3) colours.set([colour.r, colour.g, colour.b], i)
    geometry.setAttribute('color', new BufferAttribute(colours, 3))
  }
  return geometry
}

interface Edge {
  start: LocalPoint
  dir: LocalPoint
  out: LocalPoint
  len: number
  theta: number
}

function edges(ring: LocalPoint[]): Edge[] {
  const ccw = signedArea(ring) > 0
  return ring.map(([x, y], i) => {
    const [nx, ny] = ring[(i + 1) % ring.length]
    const len = Math.hypot(nx - x, ny - y)
    const dir: LocalPoint = [(nx - x) / len, (ny - y) / len]
    // The right-hand normal points out of a counter-clockwise ring.
    const out: LocalPoint = ccw ? [dir[1], -dir[0]] : [-dir[1], dir[0]]
    return { start: [x, y], dir, out, len, theta: Math.atan2(dir[1], dir[0]) }
  })
}

/** The index of the wall that faces the street: its outward normal points most toward it. */
export function frontEdge(ring: LocalPoint[], toStreet: LocalPoint): number {
  let best = 0
  let bestScore = -Infinity
  edges(ring).forEach((e, i) => {
    const score = (e.out[0] * toStreet[0] + e.out[1] * toStreet[1]) * Math.min(1, e.len / 4)
    if (score > bestScore) {
      bestScore = score
      best = i
    }
  })
  return best
}

export function houseDetails(opts: {
  ring: LocalPoint[]
  centre: LocalPoint
  wallHeight: number
  large: boolean
  front: number | null
  style: HouseStyle
  /** Picks this building's door colour. */
  seed: number
}): Details {
  const { ring, centre, wallHeight, large, front, style, seed } = opts
  const spec = large ? LARGE : HOUSE
  const out = { glass: [] as Box[], trim: [] as Box[], door: [] as Box[], wall: [] as Box[] }
  const doorColour = new Color(style.doors[seed % style.doors.length])

  // A box on a wall: `along` metres from the wall's start, `up` above the ground at its centre,
  // `off` metres out from the wall's outer face, sized w (along) x h (up) x d (out).
  const onWall = (e: Edge, along: number, up: number, off: number, w: number, h: number, d: number): Box => {
    const x = e.start[0] + e.dir[0] * along + e.out[0] * off - centre[0]
    const y = e.start[1] + e.dir[1] * along + e.out[1] * off - centre[1]
    return { x, y: up, z: -y, w, h, d, theta: e.theta }
  }
  const window_ = (e: Edge, along: number, sill: number, w: number, h: number, offset = 0) => {
    out.trim.push(onWall(e, along, sill + h / 2, FRAME.out + offset, w + 2 * FRAME.border, h + 2 * FRAME.border, FRAME.depth))
    out.glass.push(onWall(e, along, sill + h / 2, GLASS.out + offset, w, h, GLASS.depth))
    out.trim.push(onWall(e, along, sill - SILL.height / 2, SILL.out + offset, w + 2 * SILL.overhang, SILL.height, SILL.depth))
  }

  // Floors whose windows fit below the eaves.
  const floors: number[] = []
  for (let f = 0; ; f++) {
    const sill = f * spec.floorM + spec.sillM
    if (sill + spec.windowH > wallHeight - spec.eaveClearM) break
    floors.push(sill)
  }

  edges(ring).forEach((e, i) => {
    if (e.len < spec.minEdgeM) return
    const count = Math.max(1, Math.floor((e.len - 2 * spec.insetM) / spec.spacingM) + 1)
    const slots = Array.from({ length: count }, (_, k) => e.len / 2 + (k - (count - 1) / 2) * spec.spacingM)
    const isFront = !large && i === front
    // On the front, the door takes the slot left of centre; a bay window the one right of it.
    const doorSlot = isFront ? Math.floor((count - 1) / 2) : -1
    const baySlot = isFront && style.bay && e.len >= BAY.minEdgeM && count > 1 ? doorSlot + 1 : -1

    slots.forEach((along, k) => {
      floors.forEach((sill, f) => {
        if (f === 0 && k === doorSlot) {
          // The front door, a step and a porch roof on two posts.
          out.trim.push(onWall(e, along, DOOR.bottom + DOOR.h / 2, FRAME.out, DOOR.w + 2 * FRAME.border, DOOR.h + FRAME.border, FRAME.depth))
          out.door.push(onWall(e, along, DOOR.bottom + DOOR.h / 2, DOOR.out + 0.02, DOOR.w, DOOR.h, 0.04))
          out.trim.push(onWall(e, along, PORCH.step.h / 2, PORCH.step.d / 2, PORCH.step.w, PORCH.step.h, PORCH.step.d))
          if (style.porch) {
            out.trim.push(onWall(e, along, PORCH.height, PORCH.depth / 2, PORCH.width, PORCH.thick, PORCH.depth))
            for (const side of [-1, 1]) {
              out.trim.push(onWall(e, along + (side * (PORCH.width - PORCH.post)) / 2, PORCH.height / 2, PORCH.depth - PORCH.post / 2, PORCH.post, PORCH.height, PORCH.post))
            }
          }
          return
        }
        if (f === 0 && k === baySlot) {
          // A bay: a box standing out from the wall, a window on its face and one on each side.
          out.wall.push(onWall(e, along, BAY.height / 2, BAY.depth / 2, BAY.width, BAY.height, BAY.depth))
          out.trim.push(onWall(e, along, BAY.height + 0.06, BAY.depth / 2 + 0.05, BAY.width + 0.2, 0.12, BAY.depth + 0.1))
          window_(e, along, sill, BAY.windowW, spec.windowH, BAY.depth)
          // The side windows: thin along the wall, wide across the bay's side face.
          const up = sill + spec.windowH / 2
          for (const side of [-1, 1]) {
            const at = along + side * (BAY.width / 2 + FRAME.out)
            out.trim.push(onWall(e, at, up, BAY.depth / 2, FRAME.depth, spec.windowH + 2 * FRAME.border, BAY.sideW + 2 * FRAME.border))
            out.glass.push(onWall(e, at + side * (GLASS.out - FRAME.out), up, BAY.depth / 2, GLASS.depth, spec.windowH, BAY.sideW))
          }
          return
        }
        window_(e, along, sill, spec.windowW, spec.windowH)
      })
    })
  })
  const slot = (boxes: Box[], colour: Color | null = null) => (boxes.length ? [boxGeometry(boxes, colour)] : [])
  return {
    glass: slot(out.glass),
    trim: slot(out.trim),
    door: slot(out.door, doorColour),
    // The bay's box gets the wall's own uvs, so it stays a piece of its own.
    wall: out.wall.map((b) => boxGeometry([b])),
  }
}
