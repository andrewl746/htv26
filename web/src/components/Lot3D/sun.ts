import type { Vec3 } from './geometry'

// The golden-hour sun (MASTERSPEC 6.3): low, from the south-west. Both looks light from here.
const SUN_BEARING_DEG = 225
const SUN_ELEVATION_DEG = 25
const SUN_DISTANCE_M = 120

export function sunPosition(): Vec3 {
  const bearing = (SUN_BEARING_DEG * Math.PI) / 180
  const elevation = (SUN_ELEVATION_DEG * Math.PI) / 180
  const flat = SUN_DISTANCE_M * Math.cos(elevation)
  return [flat * Math.sin(bearing), SUN_DISTANCE_M * Math.sin(elevation), -flat * Math.cos(bearing)]
}
