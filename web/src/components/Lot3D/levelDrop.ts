import type { Object3D } from 'three'
import { ease } from './timeline'

// Step 5 (MASTERSPEC 6.3): the basement rises out of the ground, then each floor drops from 6 m
// above its resting height and lands with a squash and stretch. Shared by both looks (the classic
// box floors and the drawn designs), so the motion is the same.
const DROP_M = 6
/** Of a floor's 0.45 s, the last 120 ms is the landing. */
const FALL_SHARE = 0.33 / 0.45
const SQUASH = { y: 0.15, xz: 0.08 }

/**
 * Poses one level at p (0 to 1 through its span). `rest` is the y its origin rests at; a level
 * below ground (`riseM` > 0) rises that far instead of dropping.
 */
export function poseLevel(object: Object3D, p: number, rest: number, riseM: number | null): void {
  if (riseM !== null) {
    object.position.y = rest - riseM * (1 - ease.outCubic(p))
    object.scale.set(1, 1, 1)
    return
  }
  if (p < FALL_SHARE) {
    object.position.y = rest + DROP_M * (1 - ease.inQuad(p / FALL_SHARE))
    object.scale.set(1, 1, 1)
    return
  }
  const bump = Math.sin((Math.PI * (p - FALL_SHARE)) / (1 - FALL_SHARE))
  object.position.y = rest
  object.scale.set(1 + SQUASH.xz * bump, 1 - SQUASH.y * bump, 1 + SQUASH.xz * bump)
}
