import { BufferAttribute, BufferGeometry, ShapeUtils, Vector2 } from 'three'
import type { ContextBuilding, LocalPoint } from '@contracts/types'
import { openRing } from './geometry'
import type { MapFeatures, MapRoad, RoadClass } from './osmMap'
import { inFrame, ROAD_CENTRE_M, type StreetFrame } from './streetFrame'

// The streets from the map (osmMap.ts) as flat geometry: asphalt ribbons with mitred bends and a
// round pad at each junction, concrete sidewalks along the city streets, footpaths, parking lots
// (stall rows along each parking aisle, white lines between the stalls, none where a building
// stands), and sports fields and playgrounds. The lot's own street is Frontage.tsx's, so the map's
// copy of it is left out where that one runs; the map is first nudged across the street so its
// centreline lies on that one, which takes out the map's offset from the City's survey.

/** Curb to curb, by class. */
export const ROAD_WIDTH_M: Record<RoadClass, number> = {
  motorway: 22,
  trunk: 18,
  primary: 14,
  secondary: 12.5,
  tertiary: 10,
  minor: 8.5,
  service: 5.5,
  alley: 4.2,
  driveway: 3,
  parking_aisle: 6,
  path: 1.8,
}
/** Sidewalks along city streets: how far out from the curb, and how wide. */
const SIDEWALK: Partial<Record<RoadClass, { gap: number; width: number }>> = {
  primary: { gap: 0, width: 3 },
  secondary: { gap: 0, width: 3 },
  tertiary: { gap: 1.4, width: 1.8 },
  minor: { gap: 1.6, width: 1.8 },
}
const PARKING = { stallDepthM: 5.2, stallWidthM: 2.7, lineM: 0.1 }
/** Flat layers: above the frontage street's road and sidewalks, under the lot's own layers (0.02). */
export const ROAD_Y = { sidewalk: 0.01, play: 0.012, track: 0.013, field: 0.014, path: 0.015, road: 0.016, line: 0.018 }
/** How far the map's centreline may be moved onto the lot's street. */
const ALIGN = { searchM: 12, parallel: 0.95, maxShiftM: 8, nearM: 90 }
/** The map's copy of the lot's street is dropped within this of the frontage road's centreline. */
const FRONTAGE_CORRIDOR_M = 7
const PIECE_M = 8
const MITRE_LIMIT = 2.5
const PAD_SIDES = 14

/** What a road is drawn as and what yards and the continued street keep clear of. */
export interface RoadPiece {
  kind: RoadClass
  line: LocalPoint[]
  width: number
}

export interface RoadLayers {
  asphalt: BufferGeometry | null
  sidewalk: BufferGeometry | null
  path: BufferGeometry | null
  /** White parking lines. */
  lines: BufferGeometry | null
  fields: BufferGeometry | null
  track: BufferGeometry | null
  /** Schoolyards and playgrounds. */
  play: BufferGeometry | null
}

/** Flat triangles with UVs in metres (east, north), written as they come. */
class Flat {
  private readonly position: number[] = []
  private readonly uv: number[] = []

  /** Counter-clockwise in local (east, north) is counter-clockwise from above in the scene: it faces up. */
  triangle(a: LocalPoint, b: LocalPoint, c: LocalPoint, y: number): void {
    for (const p of [a, b, c]) {
      this.position.push(p[0], y, -p[1])
      this.uv.push(p[0], p[1])
    }
  }

  quad(a: LocalPoint, b: LocalPoint, c: LocalPoint, d: LocalPoint, y: number): void {
    this.triangle(a, b, c, y)
    this.triangle(a, c, d, y)
  }

  geometry(): BufferGeometry | null {
    if (this.position.length === 0) return null
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.position), 3))
    const normals = new Float32Array(this.position.length)
    for (let i = 1; i < normals.length; i += 3) normals[i] = 1
    g.setAttribute('normal', new BufferAttribute(normals, 3))
    g.setAttribute('uv', new BufferAttribute(new Float32Array(this.uv), 2))
    g.computeBoundingSphere()
    return g
  }
}

const sub = (p: LocalPoint, q: LocalPoint): LocalPoint => [p[0] - q[0], p[1] - q[1]]
const unit = ([x, y]: LocalPoint): LocalPoint => {
  const l = Math.hypot(x, y) || 1
  return [x / l, y / l]
}
/** The left-hand normal of a direction. */
const left = ([x, y]: LocalPoint): LocalPoint => [-y, x]

/** A polyline moved d to its left (negative: right), its bends mitred. */
function offset(line: LocalPoint[], d: number): LocalPoint[] {
  return line.map((p, i) => {
    const before = i > 0 ? left(unit(sub(p, line[i - 1]))) : null
    const after = i < line.length - 1 ? left(unit(sub(line[i + 1], p))) : null
    const n = before && after ? unit([before[0] + after[0], before[1] + after[1]]) : (before ?? after)!
    const cos = before && after ? Math.max(n[0] * after[0] + n[1] * after[1], 1 / MITRE_LIMIT) : 1
    return [p[0] + (n[0] * d) / cos, p[1] + (n[1] * d) / cos]
  })
}

/** The band of a polyline between offsets d0 and d1. */
function band(flat: Flat, line: LocalPoint[], d0: number, d1: number, y: number): void {
  const a = offset(line, d0)
  const b = offset(line, d1)
  for (let i = 0; i < line.length - 1; i++) flat.quad(a[i], a[i + 1], b[i + 1], b[i], y)
}

function pad(flat: Flat, [x, y]: LocalPoint, radius: number, up: number): void {
  for (let k = 0; k < PAD_SIDES; k++) {
    const [t0, t1] = [(2 * Math.PI * k) / PAD_SIDES, (2 * Math.PI * (k + 1)) / PAD_SIDES]
    flat.triangle([x, y], [x + radius * Math.cos(t0), y + radius * Math.sin(t0)], [x + radius * Math.cos(t1), y + radius * Math.sin(t1)], up)
  }
}

function inside([x, y]: LocalPoint, ring: LocalPoint[]): boolean {
  let hit = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

/** A polyline cut into pieces no longer than PIECE_M. */
function pieces(line: LocalPoint[]): LocalPoint[][] {
  const out: LocalPoint[][] = []
  for (let i = 0; i < line.length - 1; i++) {
    const [p, q] = [line[i], line[i + 1]]
    const n = Math.max(1, Math.ceil(Math.hypot(...sub(q, p)) / PIECE_M))
    for (let k = 0; k < n; k++) {
      out.push([
        [p[0] + ((q[0] - p[0]) * k) / n, p[1] + ((q[1] - p[1]) * k) / n],
        [p[0] + ((q[0] - p[0]) * (k + 1)) / n, p[1] + ((q[1] - p[1]) * (k + 1)) / n],
      ])
    }
  }
  return out
}

/**
 * The map's roads, moved across the street onto the lot's street, without the stretch the
 * frontage road draws, and without what crosses the lot: consecutive kept pieces joined again.
 */
export function placeRoads(map: MapFeatures, street: StreetFrame, reach: { back: number; ahead: number }, lot: LocalPoint[]): { roads: RoadPiece[]; shift: LocalPoint } {
  // The median distance of the map's parallel city streets near the frontage from its centreline.
  const offsets: number[] = []
  for (const r of map.roads) {
    if (!SIDEWALK[r.kind]) continue
    for (let i = 0; i < r.line.length - 1; i++) {
      const [p, q] = [inFrame(street, r.line[i]), inFrame(street, r.line[i + 1])]
      const len = Math.hypot(q.s - p.s, q.o - p.o)
      if (len < 1 || Math.abs(q.s - p.s) / len < ALIGN.parallel) continue
      const [s, o] = [(p.s + q.s) / 2, (p.o + q.o) / 2]
      if (Math.abs(s) < ALIGN.nearM && Math.abs(o - ROAD_CENTRE_M) < ALIGN.searchM) offsets.push(o - ROAD_CENTRE_M)
    }
  }
  offsets.sort((a, b) => a - b)
  const off = offsets.length ? offsets[Math.floor(offsets.length / 2)] : 0
  const move = Math.abs(off) <= ALIGN.maxShiftM ? off : 0
  const shift: LocalPoint = [-street.toward[0] * move, -street.toward[1] * move]
  const moved = (p: LocalPoint): LocalPoint => [p[0] + shift[0], p[1] + shift[1]]

  const lotRing = openRing(lot)
  const keep = (r: MapRoad, [p, q]: LocalPoint[]) => {
    const mid: LocalPoint = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
    if (inside(mid, lotRing)) return false
    const [a, b] = [inFrame(street, p), inFrame(street, q)]
    const len = Math.hypot(b.s - a.s, b.o - a.o) || 1
    const onFrontage =
      Math.abs(b.s - a.s) / len > ALIGN.parallel &&
      Math.abs((a.o + b.o) / 2 - ROAD_CENTRE_M) < FRONTAGE_CORRIDOR_M &&
      Math.min(a.s, b.s) > -reach.back - PIECE_M &&
      Math.max(a.s, b.s) < reach.ahead + PIECE_M
    return !(onFrontage && r.kind !== 'path')
  }

  const roads: RoadPiece[] = []
  for (const r of map.roads) {
    let run: LocalPoint[] = []
    const flush = () => {
      if (run.length >= 2) roads.push({ kind: r.kind, line: run, width: ROAD_WIDTH_M[r.kind] })
      run = []
    }
    for (const piece of pieces(r.line.map(moved))) {
      if (!keep(r, piece)) {
        flush()
        continue
      }
      if (run.length === 0) run.push(piece[0])
      run.push(piece[1])
    }
    flush()
  }
  return { roads, shift }
}

/** How wide a road's corridor is: a parking aisle carries its stall rows. */
export function corridorWidth(road: RoadPiece): number {
  return road.kind === 'parking_aisle' ? road.width + 2 * PARKING.stallDepthM : road.width
}

function segmentDistance(p: LocalPoint, a: LocalPoint, b: LocalPoint): number {
  const [dx, dy] = sub(b, a)
  const len2 = dx * dx + dy * dy || 1
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2))
  return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dy * t))
}

/** A road segment with its half width, filed in a grid so a point meets only the segments near it. */
interface Segment {
  a: LocalPoint
  b: LocalPoint
  half: number
}
const GRID_CELL_M = 25
/** The largest margin onRoad is asked for: segments are filed this much wider. */
const MAX_MARGIN_M = 2
const indexes = new WeakMap<RoadPiece[], Map<string, Segment[]>>()

function roadIndex(roads: RoadPiece[]): Map<string, Segment[]> {
  let index = indexes.get(roads)
  if (index) return index
  index = new Map()
  for (const r of roads) {
    if (r.kind === 'path') continue
    const half = corridorWidth(r) / 2
    const pad = half + MAX_MARGIN_M
    for (let i = 0; i < r.line.length - 1; i++) {
      const segment = { a: r.line[i], b: r.line[i + 1], half }
      const [x0, x1] = [Math.min(segment.a[0], segment.b[0]) - pad, Math.max(segment.a[0], segment.b[0]) + pad]
      const [y0, y1] = [Math.min(segment.a[1], segment.b[1]) - pad, Math.max(segment.a[1], segment.b[1]) + pad]
      for (let cx = Math.floor(x0 / GRID_CELL_M); cx <= Math.floor(x1 / GRID_CELL_M); cx++) {
        for (let cy = Math.floor(y0 / GRID_CELL_M); cy <= Math.floor(y1 / GRID_CELL_M); cy++) {
          const key = `${cx},${cy}`
          const cell = index.get(key)
          if (cell) cell.push(segment)
          else index.set(key, [segment])
        }
      }
    }
  }
  indexes.set(roads, index)
  return index
}

/** Whether any of the points lies on a road (paths aside), or within `margin` (at most 2 m) of one. */
export function onRoad(points: LocalPoint[], roads: RoadPiece[], margin: number): boolean {
  if (roads.length === 0) return false
  const index = roadIndex(roads)
  return points.some((p) => {
    const cell = index.get(`${Math.floor(p[0] / GRID_CELL_M)},${Math.floor(p[1] / GRID_CELL_M)}`)
    return cell?.some((s) => segmentDistance(p, s.a, s.b) < s.half + Math.min(margin, MAX_MARGIN_M)) ?? false
  })
}

/** Each road segment as a rectangle (paths aside), for what must keep off the roads. */
export function roadRects(roads: RoadPiece[]): LocalPoint[][] {
  const out: LocalPoint[][] = []
  for (const r of roads) {
    if (r.kind === 'path') continue
    const half = corridorWidth(r) / 2
    for (let i = 0; i < r.line.length - 1; i++) {
      const [p, q] = [r.line[i], r.line[i + 1]]
      const n = left(unit(sub(q, p)))
      out.push([
        [p[0] + n[0] * half, p[1] + n[1] * half],
        [q[0] + n[0] * half, q[1] + n[1] * half],
        [q[0] - n[0] * half, q[1] - n[1] * half],
        [p[0] - n[0] * half, p[1] - n[1] * half],
      ])
    }
  }
  return out
}

/** The flat layers for the placed roads and the map's areas. */
export function roadLayers(roads: RoadPiece[], map: MapFeatures, shift: LocalPoint, buildings: ContextBuilding[], radiusM: number): RoadLayers {
  const asphalt = new Flat()
  const sidewalk = new Flat()
  const path = new Flat()
  const lines = new Flat()
  const fields = new Flat()
  const track = new Flat()
  const play = new Flat()

  // Where road ends meet: a junction (3 or more) or a dead end (1) gets a round pad.
  const key = ([x, y]: LocalPoint) => `${Math.round(x * 2)},${Math.round(y * 2)}`
  const ends = new Map<string, { at: LocalPoint; count: number; width: number; walk: number }>()
  for (const r of roads) {
    if (r.kind === 'path') continue
    const walk = SIDEWALK[r.kind]
    for (const at of [r.line[0], r.line[r.line.length - 1]]) {
      const e = ends.get(key(at)) ?? { at, count: 0, width: 0, walk: 0 }
      e.count++
      e.width = Math.max(e.width, r.width)
      e.walk = Math.max(e.walk, walk ? r.width / 2 + walk.gap + walk.width : 0)
      ends.set(key(at), e)
    }
  }

  const rings = buildings.map((b) => openRing(b.footprint_local))
  const boxes = rings.map((ring) => {
    const xs = ring.map((p) => p[0])
    const ys = ring.map((p) => p[1])
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
  })
  const onBuilding = (p: LocalPoint) =>
    boxes.some(([x0, y0, x1, y1], i) => p[0] > x0 && p[0] < x1 && p[1] > y0 && p[1] < y1 && inside(p, rings[i]))

  for (const r of roads) {
    if (r.kind === 'path') {
      band(path, r.line, -r.width / 2, r.width / 2, ROAD_Y.path)
      continue
    }
    band(asphalt, r.line, -r.width / 2, r.width / 2, ROAD_Y.road)
    const walk = SIDEWALK[r.kind]
    if (walk) {
      band(sidewalk, r.line, r.width / 2 + walk.gap, r.width / 2 + walk.gap + walk.width, ROAD_Y.sidewalk)
      band(sidewalk, r.line, -(r.width / 2 + walk.gap + walk.width), -(r.width / 2 + walk.gap), ROAD_Y.sidewalk)
    }
    if (r.kind === 'parking_aisle') {
      // Stall rows each side, a stall at a time, none where a building stands.
      for (let i = 0; i < r.line.length - 1; i++) {
        const [p, q] = [r.line[i], r.line[i + 1]]
        const dir = unit(sub(q, p))
        const n = left(dir)
        const len = Math.hypot(...sub(q, p))
        for (let s = 0; s + PARKING.stallWidthM <= len; s += PARKING.stallWidthM) {
          for (const side of [1, -1]) {
            const [d0, d1] = [side * (r.width / 2), side * (r.width / 2 + PARKING.stallDepthM)]
            const at = (t: number, d: number): LocalPoint => [p[0] + dir[0] * t + n[0] * d, p[1] + dir[1] * t + n[1] * d]
            const corners = [at(s, d0), at(s + PARKING.stallWidthM, d0), at(s + PARKING.stallWidthM, d1), at(s, d1)]
            if (corners.some(onBuilding) || onBuilding(at(s + PARKING.stallWidthM / 2, (d0 + d1) / 2))) continue
            if (side === 1) asphalt.quad(corners[0], corners[1], corners[2], corners[3], ROAD_Y.road)
            else asphalt.quad(corners[0], corners[3], corners[2], corners[1], ROAD_Y.road)
            const h = PARKING.lineM / 2
            const [l0, l1, l2, l3] = [at(s - h, d0), at(s + h, d0), at(s + h, d1), at(s - h, d1)]
            if (side === 1) lines.quad(l0, l1, l2, l3, ROAD_Y.line)
            else lines.quad(l0, l3, l2, l1, ROAD_Y.line)
          }
        }
      }
    }
  }
  for (const e of ends.values()) {
    if (e.count === 2) continue
    pad(asphalt, e.at, e.width / 2, ROAD_Y.road)
    if (e.walk > 0 && e.count >= 3) pad(sidewalk, e.at, e.walk, ROAD_Y.sidewalk)
  }

  const moved = (ring: LocalPoint[]) => ring.map((p): LocalPoint => [p[0] + shift[0], p[1] + shift[1]])
  for (const area of map.areas) {
    const ring = moved(area.ring)
    if (ring.every((p) => Math.hypot(...p) > radiusM)) continue
    const holes = area.holes.map(moved)
    const [target, y] = area.kind === 'pitch' ? [fields, ROAD_Y.field] : area.kind === 'track' ? [track, ROAD_Y.track] : [play, ROAD_Y.play]
    const all = [...ring, ...holes.flat()]
    const v2 = (r: LocalPoint[]) => r.map(([x, yy]) => new Vector2(x, yy))
    for (const [a, b, c] of ShapeUtils.triangulateShape(v2(ring), holes.map(v2))) {
      const [pa, pb, pc] = [all[a], all[b], all[c]]
      // Face up whichever way the ring runs.
      const ccw = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0]) > 0
      if (ccw) target.triangle(pa, pb, pc, y)
      else target.triangle(pa, pc, pb, y)
    }
  }

  return {
    asphalt: asphalt.geometry(),
    sidewalk: sidewalk.geometry(),
    path: path.geometry(),
    lines: lines.geometry(),
    fields: fields.geometry(),
    track: track.geometry(),
    play: play.geometry(),
  }
}
