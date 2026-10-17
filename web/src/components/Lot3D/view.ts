// The view of a lot that the base map's flight ends on and the 3D camera starts from, so the
// crossfade between them is one camera, standing still, rather than two moves (MASTERSPEC 6.3
// step 1: the map's flight is the swoop).

export const FOV_DEG = 40
/** 35° above the ground (MASTERSPEC 6.3 step 1): MapLibre pitch 55°. */
export const REST_TILT_DEG = 35
/** Both cameras look at the lot centroid on the ground, as a map's centre is. */
export const TARGET_HEIGHT_M = 0
/** A lot with no measurable frontage has no bearing; look from the south. */
const DEFAULT_FRONT_BEARING_DEG = 180

// Distance from the lot: the spec's 45 m for a small lot, further out for a deep lot or a tall
// building (a 24 m condo filled the whole view at a fixed 60 m).
const DISTANCE_PER_M = 2.4
const HEIGHT_WEIGHT = 1.6
const MIN_DISTANCE_M = 45
const MAX_DISTANCE_M = 110

/** The resting camera distance for a lot of this radius (from its centroid) holding something this tall. */
export function restDistance(lotRadiusM: number, tallestM: number): number {
  const frame = Math.max(lotRadiusM, HEIGHT_WEIGHT * tallestM)
  return Math.min(MAX_DISTANCE_M, Math.max(MIN_DISTANCE_M, DISTANCE_PER_M * frame))
}

/** The camera stands on the street side, so it looks the opposite way to the lot's front bearing. */
export function restViewBearingDeg(frontBearingDeg: number | null): number {
  const looking = (frontBearingDeg ?? DEFAULT_FRONT_BEARING_DEG) + 180
  return ((looking + 180) % 360) - 180
}
