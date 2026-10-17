import { FOV_DEG, SWOOP_START_M, TARGET_HEIGHT_M } from '../Lot3D/view'

const EARTH_CIRCUMFERENCE_M = 40075016.686
/** MapLibre's world is 512 px wide at zoom 0. */
const TILE_PX = 512

/** The map zoom at which the ground looks the size it does through the 3D camera at the top of its swoop. */
export function handoffZoom(lat: number, heightPx: number): number {
  const altitude = SWOOP_START_M + TARGET_HEIGHT_M
  const metresPerPx = (2 * altitude * Math.tan((FOV_DEG * Math.PI) / 360)) / heightPx
  return Math.log2((EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / (TILE_PX * metresPerPx))
}
