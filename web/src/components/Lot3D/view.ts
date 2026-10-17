// The 3D camera's opening view. The base map's fly-in ends on exactly this view so the crossfade
// into the scene reads as one camera move.

export const FOV_DEG = 40
/** The swoop starts looking straight down from this far above the lot (MASTERSPEC 6.3 step 1). */
export const SWOOP_START_M = 120
/** The camera looks at this point above the lot centroid. */
export const TARGET_HEIGHT_M = 2
/** At the handoff the map has north up, so the swoop starts from there. */
export const START_BEARING_DEG = 0
