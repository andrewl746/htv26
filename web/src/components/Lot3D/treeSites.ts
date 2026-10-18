import type { ContextBuilding, LocalPoint } from '@contracts/types'
import { openRing } from './geometry'

// Where the street's trees may stand. The City's street-tree points are not all on the street:
// about one in six round the demo lots lies inside a house (at its address, it seems), and some lie
// on the lot being checked, where the design and its garden go. Those are left out, as is a tree
// right against a wall; a tree near a house keeps its crown from reaching into it. Decoration only.

export const TREE_CLEAR = {
  /** A trunk stands at least this far outside every building. */
  trunkM: 1,
  /** A crown may reach this far over a wall, as one overhangs the eaves. */
  overhangM: 0.6,
}
/** No crown reaches further than this from its trunk (Trees.tsx's widest), so further buildings are not looked at. */
const LOOK_M = 4

export interface TreeSite {
  at: LocalPoint
  /** How far the crown may reach from the trunk. */
  crownM: number
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

/** How far a point lies outside a ring; 0 inside it. */
function outsideBy(p: LocalPoint, ring: LocalPoint[]): number {
  if (inside(p, ring)) return 0
  let nearest = Infinity
  for (let i = 0; i < ring.length; i++) {
    const [a, b] = [ring[i], ring[(i + 1) % ring.length]]
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]]
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)))
    nearest = Math.min(nearest, Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t))
  }
  return nearest
}

/** The trees clear of every building and of the checked lot, each with the room its crown has. */
export function treeSites(trees: LocalPoint[], buildings: ContextBuilding[], lot: LocalPoint[]): TreeSite[] {
  const rings = buildings.map((b) => openRing(b.footprint_local))
  const boxes = rings.map((ring) => {
    const xs = ring.map((p) => p[0])
    const ys = ring.map((p) => p[1])
    return [Math.min(...xs) - LOOK_M, Math.min(...ys) - LOOK_M, Math.max(...xs) + LOOK_M, Math.max(...ys) + LOOK_M]
  })
  const lotRing = openRing(lot)
  const sites: TreeSite[] = []
  for (const at of trees) {
    if (inside(at, lotRing)) continue
    let room = LOOK_M
    rings.forEach((ring, i) => {
      const [x0, y0, x1, y1] = boxes[i]
      if (at[0] > x0 && at[0] < x1 && at[1] > y0 && at[1] < y1) room = Math.min(room, outsideBy(at, ring))
    })
    if (room >= TREE_CLEAR.trunkM) sites.push({ at, crownM: room + TREE_CLEAR.overhangM })
  }
  return sites
}
