import type { Vec3 } from './geometry'
import { updateSinks } from './occlusion'
import { useSequenceFrame } from './useSequence'

/** Each frame, sinks the neighbours that hide any of these points from the camera: the design's corners, or the lot's. */
export function CutawayFocus({ targets }: { targets: Vec3[] }) {
  // After the camera has moved this frame (-0.5).
  useSequenceFrame((_t, { reduced }, { camera }, delta) => updateSinks(camera.position, targets, delta, reduced))
  return null
}
