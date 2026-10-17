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

/** Drops the repeated closing point that closed rings carry. */
export function openRing(points: LocalPoint[]): LocalPoint[] {
  const [first, last] = [points[0], points[points.length - 1]]
  return points.length > 1 && first[0] === last[0] && first[1] === last[1] ? points.slice(0, -1) : points
}

/** A Shape from a local polygon; three drops a repeated closing point when it triangulates. */
export function shapeFrom(points: LocalPoint[]): Shape {
  const shape = new Shape()
  points.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)))
  return shape
}

/** The ring as scene points at a fixed height, closed, for outlines. */
export function ringAt(points: LocalPoint[], height: number): Vec3[] {
  const ring = openRing(points)
  return [...ring, ring[0]].map((p) => toScene(p, height))
}

export function perimeter(points: LocalPoint[]): number {
  const ring = openRing(points)
  return ring.reduce((sum, [x, y], i) => {
    const [nx, ny] = ring[(i + 1) % ring.length]
    return sum + Math.hypot(nx - x, ny - y)
  }, 0)
}

/** The mean of the vertices: a pivot to grow and squash around, not the area centroid. */
export function vertexMean(points: LocalPoint[]): LocalPoint {
  const ring = openRing(points)
  const sum = ring.reduce(([sx, sy], [x, y]) => [sx + x, sy + y], [0, 0])
  return [sum[0] / ring.length, sum[1] / ring.length]
}

/** Positive when the ring runs counter-clockwise. */
export function signedArea(points: LocalPoint[]): number {
  const ring = openRing(points)
  return ring.reduce((sum, [x, y], i) => {
    const [nx, ny] = ring[(i + 1) % ring.length]
    return sum + x * ny - nx * y
  }, 0) / 2
}

export function midpoint([ax, ay]: LocalPoint, [bx, by]: LocalPoint): LocalPoint {
  return [(ax + bx) / 2, (ay + by) / 2]
}

/** A stable small hash so a building keeps the same colour between runs (MASTERSPEC 6.3 step 2). */
export function seededIndex(id: number, n: number): number {
  let h = Math.imul(id ^ (id >>> 16), 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  h ^= h >>> 16
  return (h >>> 0) % n
}

/** A repeatable random sequence in [0, 1), seeded by a position, for tree sizes. */
export function seededRandom([x, y]: LocalPoint): () => number {
  let s = (Math.imul(Math.round(x * 10), 73856093) ^ Math.imul(Math.round(y * 10), 19349663)) >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
