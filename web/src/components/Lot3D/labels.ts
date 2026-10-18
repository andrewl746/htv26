import type { ContextBuilding, Design, DesignHome, LocalPoint, Result, RuleId, RuleRow } from '@contracts/types'
import { disclaimers, fill, formatNumber, labels, pending } from '../../copy'
import { slabAnchor, type FailSlab } from './failSlabs'
import { midpoint, toScene, type Vec3 } from './geometry'
import { planFloors, pointOn } from './floors'

// The words that float in the 3D scene (MASTERSPEC 6.3 steps 4 and 6). They are plain DOM beside
// the canvas; LabelProjector moves each one to its point in the scene every frame.

export interface SceneLabel {
  key: string
  text: string
  position: Vec3
  /** Which way the label hangs from its point. */
  align: 'center' | 'left' | 'right'
  muted: boolean
  /** A result icon before the text (the fail slab's label), so the result never rests on colour. */
  icon: Result | null
  /** A second, muted line. */
  detail: string | null
  /** When it fades in: the old-house step, a home's slot in the labels step, or the fail slab. */
  appear: { step: 'oldHouse' } | { step: 'labels'; index: number } | { step: 'fail' }
}

const OLD_HOUSE_LABEL_Y = 0.4
/** Home labels sit just in front of the front wall. */
const LABEL_OUT_M = 0.4

/** "Illustrative new-build scenario" over a house that goes, or "No building here today" on a vacant lot. */
export function oldHouseLabels({
  buildings,
  vacant,
  frontage,
  squash,
}: {
  buildings: ContextBuilding[]
  vacant: boolean
  frontage: [LocalPoint, LocalPoint] | null
  squash: boolean
}): SceneLabel[] {
  const hasHouse = buildings.some((b) => b.on_lot)
  const text = hasHouse ? (squash ? disclaimers.illustrative : null) : vacant ? disclaimers.no_building : null
  if (!text) return []
  const at: LocalPoint = frontage ? midpoint(...frontage) : [0, 0]
  return [
    {
      key: 'old-house',
      text,
      position: toScene(at, OLD_HOUSE_LABEL_Y),
      align: 'center',
      muted: true,
      icon: null,
      detail: null,
      appear: { step: 'oldHouse' },
    },
  ]
}

function homeText(home: DesignHome): string {
  const template = home.bedrooms === 1 ? pending.home_bedrooms_one : pending.home_bedrooms
  return `${home.label} · ${fill(template, { bedrooms: home.bedrooms })}`
}

/**
 * "Basement home · 2 bedrooms", one per home, from designs.json. Homes in the left half of the
 * building label out to the left and the others to the right, so two homes on one floor never
 * cover each other.
 */
export function homeLabels(placement: LocalPoint[], design: Design): SceneLabel[] {
  const plan = planFloors(placement, design)
  return design.homes.map((home, index) => {
    const levels = plan.levels.filter((l) => l.slabs.some((s) => s.home?.id === home.id))
    const lowest = levels[0] ?? plan.levels[0]
    const slab = lowest.slabs.find((s) => s.home?.id === home.id) ?? lowest.slabs[0]
    const side = lowest.slabs.length > 1 && slab.to <= 0.5 ? 'left' : 'right'
    const bottom = Math.max(0, Math.min(...levels.map((l) => l.bottom)))
    const top = Math.max(...levels.map((l) => l.bottom + l.height))
    const point = pointOn(plan.frame, side === 'left' ? 0 : 1, lowest.stepback - LABEL_OUT_M)
    return {
      key: `home-${home.id}`,
      text: homeText(home),
      position: toScene(point, (bottom + top) / 2),
      align: side,
      muted: false,
      icon: null,
      detail: null,
      appear: { step: 'labels', index },
    }
  })
}

/** The fail slab's label floats this far over the slab's top. */
const FAIL_LABEL_RISE_M = 1.2
/**
 * Rules the lot must reach (its width, its depth): their label reads "Needs 7.6 m · This lot
 * 6.1 m". The others set a maximum on the design (length, height, coverage, homes), where the
 * actual value is the design's, not the lot's, so their label gives the signed margin instead.
 */
const LOT_MINIMUMS: RuleId[] = ['lot_width', 'lot_depth']
const MINUS = '−'

function measure(value: number, unit: RuleRow['unit']): string {
  const number = formatNumber(value)
  if (!unit) return number
  return unit === 'pct' ? `${number}${labels.units.pct}` : `${number} ${labels.units[unit]}`
}

function signed(value: number, unit: RuleRow['unit']): string {
  return `${value < 0 ? MINUS : '+'}${measure(Math.abs(value), unit)}`
}

/**
 * "Doesn't fit · Lot width · Needs 7.6 m · This lot 6.1 m" or "Doesn't fit · Building length ·
 * Margin −2 m", with the by-law section under it; or "Too close to call · ..." over the striped
 * slab. Every word comes from contracts/copy; a rule whose values are words (not numbers) shows
 * no values.
 */
export function failLabel(slab: FailSlab): SceneLabel {
  const { rule } = slab
  const parts: string[] = [labels.results[slab.kind]]
  if (rule) {
    parts.push(labels.rules[rule.rule_id])
    const { required, actual, margin, unit } = rule
    if (LOT_MINIMUMS.includes(rule.rule_id) && typeof required === 'number' && typeof actual === 'number') {
      parts.push(`${labels.ui.column_required} ${measure(required, unit)}`, `${labels.ui.column_actual} ${measure(actual, unit)}`)
    } else if (typeof margin === 'number') {
      parts.push(`${labels.ui.column_margin} ${signed(margin, unit)}`)
    }
  }
  return {
    key: 'fail',
    text: parts.join(' · '),
    position: toScene(slabAnchor(slab), slab.top + FAIL_LABEL_RISE_M),
    align: 'center',
    muted: false,
    icon: slab.kind,
    detail: rule ? `${labels.ui.column_bylaw} ${rule.bylaw_section}` : null,
    appear: { step: 'fail' },
  }
}
