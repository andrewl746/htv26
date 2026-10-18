import { designById } from '../../designs'

/**
 * The Fourplex Wide in chalk for the landing sheet's bottom-right corner: a line sketch at
 * designs.json's sizes, seen from the front right and above, the front nearly square on and the long
 * side running back at half scale, so it reads as a three-storey house rather than a long block.
 * Only the faces turned to the viewer: the side's stepped profile, the front up to the terrace, the
 * terrace, the stepped-back top floor and the roof, the floor lines and a door and two windows a
 * floor on the front. None of them overlaps another from here, so nothing needs hiding.
 */

const DESIGN = designById('fourplex_wide')

/** The axes: the front rises gently to the left, the side steeply to the right, foreshortened. */
const FRONT = { angle: (12 * Math.PI) / 180, scale: 1 }
const SIDE = { angle: (40 * Math.PI) / 180, scale: 0.5 }

/** The front's openings (m), and the centres of its two bays as shares of its width from the near
 *  corner; the door takes the near bay on the ground floor. */
const WINDOW = { width: 1.2, height: 1.6, sill: 0.9 }
const DOOR = { width: 1, height: 2.1 }
const BAYS = [0.28, 0.72]

/** Across the front from the near corner, back along the side from the front, and up from grade (m). */
type Point = [a: number, v: number, z: number]

export type FourplexSketch = { width: number; height: number; d: string }

const r2 = (n: number) => Math.round(n * 100) / 100

/** The sketch `height` px tall: its width and its lines as one path (px, top-left at 0 0). */
export function drawFourplex(height: number): FourplexSketch {
  const W = DESIGN.width_m
  const L = DESIGN.length_m
  const H = DESIGN.height_m
  const back = DESIGN.top_floor_stepback_m

  // Each level's base above grade; only the basement's visible part stands above it.
  const levels = [...DESIGN.levels].sort((p, q) => p.level - q.level)
  const bases: number[] = []
  let z = 0
  for (const level of levels) {
    bases.push(z)
    z += level.visible_m
  }
  const upper = levels.findIndex((level) => level.stepped_back)
  const terrace = bases[upper]

  // Screen px per metre along each axis, across and up.
  const fx = FRONT.scale * Math.cos(FRONT.angle)
  const fy = FRONT.scale * Math.sin(FRONT.angle)
  const sx = SIDE.scale * Math.cos(SIDE.angle)
  const sy = SIDE.scale * Math.sin(SIDE.angle)
  const k = height / (W * fy + L * sy + H)
  const at = ([a, v, h]: Point) => `${r2(((W - a) * fx + v * sx) * k)} ${r2(height - (a * fy + v * sy + h) * k)}`
  const line = (points: Point[], closed = false) => `M${points.map(at).join('L')}${closed ? 'Z' : ''}`
  const box = (v: number, centre: number, w: number, z0: number, h: number) => {
    const a0 = centre * W - w / 2
    const a1 = a0 + w
    return line([[a0, v, z0], [a1, v, z0], [a1, v, z0 + h], [a0, v, z0 + h]], true)
  }

  let d = ''
  // The side's profile, stepping back at the terrace; the front below it; then the terrace, the top
  // floor's front and the roof, each without the edges already drawn.
  d += line([[0, 0, 0], [0, L, 0], [0, L, H], [0, back, H], [0, back, terrace], [0, 0, terrace]], true)
  d += line([[0, 0, 0], [W, 0, 0], [W, 0, terrace], [0, 0, terrace]])
  d += line([[W, 0, terrace], [W, back, terrace], [0, back, terrace]])
  d += line([[W, back, terrace], [W, back, H], [0, back, H]])
  d += line([[W, back, H], [W, L, H], [0, L, H]])
  // Floor lines on the front only: run down the long side too, they turn it into stacked slabs.
  for (const base of bases.slice(1, upper)) d += line([[0, 0, base], [W, 0, base]])
  // The openings on the front of each floor above the basement.
  levels.forEach((level, i) => {
    if (level.level < 0) return
    const v = level.stepped_back ? back : 0
    BAYS.forEach((centre, bay) => {
      d +=
        level.level === 0 && bay === 0
          ? box(v, centre, DOOR.width, bases[i], DOOR.height)
          : box(v, centre, WINDOW.width, bases[i] + WINDOW.sill, WINDOW.height)
    })
  })

  return { width: r2((W * fx + L * sx) * k), height, d }
}
