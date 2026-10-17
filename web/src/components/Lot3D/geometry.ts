import { Shape } from 'three'
import type { LocalPoint } from '@contracts/types'

// Local frame (MASTERSPEC 3.9): metres east (x) and north (y) from the lot centroid.
// Scene frame: x east, y up, z south, so local y maps to scene -z and north points away
// from a camera on the south side.

export type Vec3 = [number, number, number]

/** Rotation that lays a Shape (drawn in local x, y) flat on the ground; extrusion depth becomes height. */
export const FLAT: Vec3 = [-Math.PI / 2, 0, 0]

export function toScene([x, y]: LocalPoint, height = 0): Vec3 {
  return [x, height, -y]
}

/** A Shape from a local polygon; three drops a repeated closing point when it triangulates. */
export function shapeFrom(points: LocalPoint[]): Shape {
  const shape = new Shape()
  points.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)))
  return shape
}

/** The ring as scene points at a fixed height, closed, for outlines. */
export function ringAt(points: LocalPoint[], height: number): Vec3[] {
  const ring = points.map((p) => toScene(p, height))
  const [first, last] = [points[0], points[points.length - 1]]
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push(toScene(first, height))
  return ring
}

/** A stable small hash so a building keeps the same colour between runs (MASTERSPEC 6.3 step 2). */
export function seededIndex(id: number, n: number): number {
  let h = Math.imul(id ^ (id >>> 16), 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  h ^= h >>> 16
  return (h >>> 0) % n
}
