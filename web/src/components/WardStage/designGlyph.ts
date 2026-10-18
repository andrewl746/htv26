import type { DesignId } from '@contracts/types'
import { designById } from '../../designs'
import { DESIGN_ORDER, FILTERS, type DesignFilter } from '../WardMap/designs'

/**
 * The design picker's little drawings (DesignPicker.tsx): each design's front as an outline at its
 * real width and height from designs.json, one scale for all four so the narrow and wide ones compare,
 * standing on a ground line with a line at each floor. "All designs" stands the four side by side at
 * half that scale. One path each, in px with the top-left at 0 0.
 */

/** The drawing's box (px). */
export const GLYPH = { width: 32, height: 22 }
/** The ground line, a little above the box's foot so its stroke is not cut. */
const GROUND = GLYPH.height - 1.5
/** px per metre for one design, and for each of the four in "All designs". */
const SCALE = 1.9
const ALL_SCALE = 1
/** The gap between the four in "All designs" (px). */
const ALL_GAP = 1.5

const r1 = (n: number) => Math.round(n * 10) / 10

/** One design's front, centred on `cx`, at `scale` px per metre. */
function front(id: DesignId, cx: number, scale: number): string {
  const design = designById(id)
  const x0 = cx - (design.width_m * scale) / 2
  const x1 = cx + (design.width_m * scale) / 2
  const floor = (design.height_m / design.storeys) * scale
  let d = `M${r1(x0)} ${GROUND}V${r1(GROUND - design.height_m * scale)}H${r1(x1)}V${GROUND}`
  for (let i = 1; i < design.storeys; i++) d += `M${r1(x0)} ${r1(GROUND - i * floor)}H${r1(x1)}`
  return d
}

function all(): string {
  const widths = DESIGN_ORDER.map((id) => designById(id).width_m * ALL_SCALE)
  let x = (GLYPH.width - widths.reduce((a, b) => a + b, 0) - ALL_GAP * (widths.length - 1)) / 2
  return DESIGN_ORDER.map((id, i) => {
    const d = front(id, x + widths[i] / 2, ALL_SCALE)
    x += widths[i] + ALL_GAP
    return d
  }).join('')
}

const ground = `M1 ${GROUND}H${GLYPH.width - 1}`

/** Every filter's drawing, worked out once. */
export const GLYPHS = Object.fromEntries(
  FILTERS.map((filter) => [filter, ground + (filter === 'all' ? all() : front(filter, GLYPH.width / 2, SCALE))]),
) as Record<DesignFilter, string>
