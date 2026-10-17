// The 3D camera's opening view. The base map's fly-in ends on exactly this view so the crossfade
// into the scene reads as one camera move.

export const FOV_DEG = 40
/** The swoop starts looking straight down from this far above the lot (MASTERSPEC 6.3 step 1). */
export const SWOOP_START_M = 120
/** The camera looks at this point above the lot centroid. */
export const TARGET_HEIGHT_M = 2
/** At the handoff the map has north up, so the swoop starts from there. */
export const START_BEARING_DEG = 0

// Where the swoop comes to rest: the spec's 45 m for a small lot, further out for a deep lot or a
// tall building (a 24 m condo filled the whole view at a fixed 60 m).
const DISTANCE_PER_M = 2.4
const HEIGHT_WEIGHT = 1.6
const MIN_DISTANCE_M = 45
const MAX_DISTANCE_M = 110

/** The resting camera distance for a lot of this radius (from its centroid) holding something this tall. */
export function restDistance(lotRadiusM: number, tallestM: number): number {
  const frame = Math.max(lotRadiusM, HEIGHT_WEIGHT * tallestM)
  return Math.min(MAX_DISTANCE_M, Math.max(MIN_DISTANCE_M, DISTANCE_PER_M * frame))
}
