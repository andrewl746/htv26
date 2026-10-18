import { DataTexture, FloatType, RedFormat, type Vector3 } from 'three'
import type { Vec3 } from './geometry'

// Which neighbours stand between the camera and the design, and how far each has sunk out of the
// way (cutaway.ts draws the sinking). Each frame every building and tree, as a box, is tested
// against sight lines from the camera to the corners of the design: a few thousand cheap tests.

/** MASTERSPEC 6.3 performance: at most 400 buildings and 300 trees, one sink slot each. */
export const SLOTS = { buildings: 400, trees: 300 }
const GROUP_START = { buildings: 0, trees: SLOTS.buildings }
const SLOT_COUNT = SLOTS.buildings + SLOTS.trees
/** How long a neighbour takes to sink out of the way, or to stand back up once the camera has passed. */
const SINK_S = 0.4
/** prefers-reduced-motion (MASTERSPEC 6.7). */
const SINK_REDUCED_S = 0.1

export type OccluderGroup = keyof typeof SLOTS

/** A building or tree as a box standing on the ground, in scene coordinates (x, up, z). */
export interface Box {
  /** Centre of the base. */
  x: number
  z: number
  /** The box's first axis, a unit vector in the ground plane; the second is square to it. */
  ux: number
  uz: number
  halfU: number
  halfV: number
  top: number
}

const boxes: Record<OccluderGroup, Box[]> = { buildings: [], trees: [] }
/** How far each slot has sunk, 0 to 1, before easing. */
const level = new Float32Array(SLOT_COUNT)
const blocking = new Uint8Array(SLOT_COUNT)

/** Counts the frames in which any slot moved, so a frozen shadow map knows to redraw (Settle.tsx). */
let moves = 0

export function sinkMoves(): number {
  return moves
}

/** The eased sink of every slot, read by the cutaway shader. */
export const sinkTexture = new DataTexture(new Float32Array(SLOT_COUNT), SLOT_COUNT, 1, RedFormat, FloatType)
sinkTexture.needsUpdate = true

/** A group's boxes in slot order: box i sinks slot i of the group. A new set starts standing. */
export function setOccluders(group: OccluderGroup, list: Box[]): void {
  boxes[group] = list.slice(0, SLOTS[group])
  const start = GROUP_START[group]
  level.fill(0, start, start + SLOTS[group])
  ;(sinkTexture.image.data as Float32Array).fill(0, start, start + SLOTS[group])
  sinkTexture.needsUpdate = true
}

export function slotOf(group: OccluderGroup, index: number): number {
  return GROUP_START[group] + index
}

/** Moves every slot one frame toward sunk (if it hides any target from the eye) or standing. */
export function updateSinks(eye: Vector3, targets: Vec3[], delta: number, reduced: boolean): void {
  blocking.fill(0)
  for (const group of Object.keys(boxes) as OccluderGroup[]) {
    boxes[group].forEach((box, i) => {
      if (targets.some((target) => hides(box, eye, target))) blocking[GROUP_START[group] + i] = 1
    })
  }
  const step = delta / (reduced ? SINK_REDUCED_S : SINK_S)
  const shown = sinkTexture.image.data as Float32Array
  let changed = false
  for (let i = 0; i < SLOT_COUNT; i++) {
    const next = Math.min(1, Math.max(0, level[i] + (blocking[i] ? step : -step)))
    if (next === level[i]) continue
    level[i] = next
    shown[i] = next * next * (3 - 2 * next)
    changed = true
  }
  if (changed) {
    sinkTexture.needsUpdate = true
    moves++
  }
}

/** Whether the sight line from the eye to the target passes through the box (a slab test). */
function hides(box: Box, eye: Vector3, [tx, ty, tz]: Vec3): boolean {
  // Both ends in the box's own frame: u and v across the ground, y up.
  const toU = (x: number, z: number) => (x - box.x) * box.ux + (z - box.z) * box.uz
  const toV = (x: number, z: number) => -(x - box.x) * box.uz + (z - box.z) * box.ux
  const start = [toU(eye.x, eye.z), eye.y, toV(eye.x, eye.z)]
  const end = [toU(tx, tz), ty, toV(tx, tz)]
  const slabs = [
    [-box.halfU, box.halfU],
    [0, box.top],
    [-box.halfV, box.halfV],
  ]
  let near = 0
  let far = 1
  for (let k = 0; k < 3; k++) {
    const [lo, hi] = slabs[k]
    const d = end[k] - start[k]
    if (Math.abs(d) < 1e-9) {
      if (start[k] < lo || start[k] > hi) return false
      continue
    }
    const a = (lo - start[k]) / d
    const b = (hi - start[k]) / d
    near = Math.max(near, Math.min(a, b))
    far = Math.min(far, Math.max(a, b))
    if (near > far) return false
  }
  return true
}
