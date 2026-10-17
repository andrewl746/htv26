import { FOV_DEG } from '../Lot3D/view'

const EARTH_CIRCUMFERENCE_M = 40075016.686
/** MapLibre's world is 512 px wide at zoom 0. */
const TILE_PX = 512

/**
 * The map zoom that puts MapLibre's camera this many metres from the map centre, with the map's
 * field of view set to the 3D camera's. MapLibre keeps its camera 0.5 / tan(fov / 2) screen
 * heights from the centre, in pixels; this converts that to metres at the centre's latitude.
 */
export function zoomForDistance(lat: number, heightPx: number, distanceM: number): number {
  const cameraPx = (0.5 * heightPx) / Math.tan((FOV_DEG * Math.PI) / 360)
  const metresPerPx = distanceM / cameraPx
  return Math.log2((EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / (TILE_PX * metresPerPx))
}
