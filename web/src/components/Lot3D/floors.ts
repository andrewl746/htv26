import type { Design, DesignHome, DesignLevel, LocalPoint } from '@contracts/types'
import { vertexMean } from './geometry'

// Lays the design's levels and homes (designs.json `levels[]`, `homes[]`) onto its placement.
// Placement corners are front-left, front-right, rear-right, rear-left (contracts/types.ts).

/** Thin gaps so the floors and the homes read one by one. */
const FLOOR_SEAM_M = 0.08
const HOME_SEAM_M = 0.08

export interface PlacementFrame {
  frontLeft: LocalPoint
  /** Front-left to front-right. */
  across: LocalPoint
  /** Unit vector from the front wall toward the rear. */
  back: LocalPoint
  width: number
  length: number
  centre: LocalPoint
}

export interface PlannedSlab {
  home: DesignHome | null
  /** Share of the width this home takes, from the left wall. */
  from: number
  to: number
  corners: LocalPoint[]
}

export interface PlannedLevel {
  level: DesignLevel
  /** Height of the floor's underside above grade; negative for the basement. */
  bottom: number
  /** Solid height of the slab, the seam taken off. */
  height: number
  stepback: number
  slabs: PlannedSlab[]
}

export interface FloorPlan {
  frame: PlacementFrame
  levels: PlannedLevel[]
}

export function placementFrame(placement: LocalPoint[]): PlacementFrame {
  const [fl, fr, , rl] = placement
  const across: LocalPoint = [fr[0] - fl[0], fr[1] - fl[1]]
  const along: LocalPoint = [rl[0] - fl[0], rl[1] - fl[1]]
  const length = Math.hypot(...along)
  return {
    frontLeft: fl,
    across,
    back: [along[0] / length, along[1] / length],
    width: Math.hypot(...across),
    length,
    centre: vertexMean(placement),
  }
}

/** The point a share of the width across and some metres back from the front wall. */
export function pointOn(frame: PlacementFrame, share: number, metresBack: number): LocalPoint {
  return [
    frame.frontLeft[0] + frame.across[0] * share + frame.back[0] * metresBack,
    frame.frontLeft[1] + frame.across[1] * share + frame.back[1] * metresBack,
  ]
}

export function planFloors(placement: LocalPoint[], design: Design): FloorPlan {
  const frame = placementFrame(placement)
  const seam = HOME_SEAM_M / 2 / frame.width
  let top: number | null = null

  const levels = [...design.levels]
    .sort((a, b) => a.level - b.level)
    .map((level): PlannedLevel => {
      // The lowest level shows only visible_m above grade; each level above sits on the one below.
      const bottom: number = top ?? level.visible_m - level.height_m
      top = bottom + level.height_m
      const stepback = level.stepped_back ? design.top_floor_stepback_m : 0
      const homes = design.homes.filter((h) => h.levels.includes(level.level)).sort((a, b) => a.id - b.id)
      const shares = homes.length ? homes : [null]
      const slabs = shares.map((home, i, all) => {
        const from = i / all.length + (i > 0 ? seam : 0)
        const to = (i + 1) / all.length - (i < all.length - 1 ? seam : 0)
        const corners = [
          pointOn(frame, from, stepback),
          pointOn(frame, to, stepback),
          pointOn(frame, to, frame.length - stepback),
          pointOn(frame, from, frame.length - stepback),
        ]
        return { home, from, to, corners }
      })
      return { level, bottom, height: level.height_m - FLOOR_SEAM_M, stepback, slabs }
    })

  return { frame, levels }
}
