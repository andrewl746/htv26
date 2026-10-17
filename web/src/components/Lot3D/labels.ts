import type { ContextBuilding, Design, DesignHome, LocalPoint } from '@contracts/types'
import { disclaimers, fill, pending } from '../../copy'
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
  /** A colour dot before the text: the home's colour token. */
  swatch: string | null
  /** When it fades in: the old-house step, or a home's slot in the labels step. */
  appear: { step: 'oldHouse' } | { step: 'labels'; index: number }
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
      swatch: null,
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
      swatch: `var(--suplex-home-${home.id})`,
      appear: { step: 'labels', index },
    }
  })
}
