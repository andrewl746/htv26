import type { Vec3 } from './geometry'

/** A camera pose in the 3D scene's frame (metres from the lot centroid; x east, y up, z south). */
export interface BridgedPose {
  position: Vec3
  target: Vec3
}

/**
 * While the base map is still flying in and the 3D scene fades in over it, the 3D camera reads the
 * map camera's pose from here every frame, so both draw the same view as they move together.
 * BaseMap sets `read` for the flight and clears it on landing.
 */
export const cameraBridge: { read: (() => BridgedPose) | null } = { read: null }
