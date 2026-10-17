import { FOV_DEG } from '../Lot3D/view'

const EARTH_CIRCUMFERENCE_M = 40075016.686
/** MapLibre's world is 512 px wide at zoom 0. */
const TILE_PX = 512

// MapLibre keeps its camera 0.5 / tan(fov / 2) screen heights from the map centre, in pixels. With
// the map's field of view set to the 3D camera's, these convert that to and from metres at a
// latitude.

function cameraPx(heightPx: number): number {
  return (0.5 * heightPx) / Math.tan((FOV_DEG * Math.PI) / 360)
}

function metresPerPxAtZoom0(lat: number): number {
  return (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / TILE_PX
}

/** The map zoom that puts MapLibre's camera this many metres from the map centre. */
export function zoomForDistance(lat: number, heightPx: number, distanceM: number): number {
  return Math.log2(metresPerPxAtZoom0(lat) / (distanceM / cameraPx(heightPx)))
}

/** How many metres MapLibre's camera stands from the map centre at this zoom. */
export function distanceForZoom(lat: number, heightPx: number, zoom: number): number {
  return (cameraPx(heightPx) * metresPerPxAtZoom0(lat)) / 2 ** zoom
}
