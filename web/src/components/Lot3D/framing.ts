import type { CheckResponse, DesignId } from '@contracts/types'
import { designById } from '../../designs'
import { buildingTop } from './buildings'
import { openRing } from './geometry'
import { restDistance, restViewBearingDeg } from './view'

export interface Framing {
  /** Metres from the lot centroid to the camera at rest. */
  distanceM: number
  /** Compass direction the camera looks in at rest. */
  viewBearingDeg: number
}

/** How a lot is framed at rest, shared by the base map's flight and the 3D camera. */
export function lotFraming(check: CheckResponse, designId: DesignId | null): Framing {
  const lotRadius = Math.max(...openRing(check.lot.polygon_local).map(([x, y]) => Math.hypot(x, y)))
  const onLot = check.context.buildings.filter((b) => b.on_lot).map(buildingTop)
  const placed = check.designs.find((d) => d.design_id === designId)?.placement_local
  const designHeight = placed && designId ? designById(designId).height_m : 0
  return {
    distanceM: restDistance(lotRadius, Math.max(0, designHeight, ...onLot)),
    viewBearingDeg: restViewBearingDeg(check.lot.front_bearing_deg),
  }
}
