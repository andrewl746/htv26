import { useMemo } from 'react'
import type { Feature, Polygon } from 'geojson'
import type { CheckResponse } from '@contracts/types'
import type { WardData } from './data'
import { circleRing, countFitsNear } from './nearYourLot'
import type { NearYourLot } from './WardPanel'

/**
 * "Near your lot" for one ward and one address check: the dashed circle for the map and the counts
 * for the panel box. Both are null without a check, so nothing shows. N is counted in the browser
 * from the ward file; M is the engine's own `permits_nearby.count`, never recounted.
 */
export function useNearYourLot(
  check: CheckResponse | null | undefined,
  data: WardData | null,
): { nearRing: Feature<Polygon> | null; near: NearYourLot | null } {
  const originLon = check?.context.origin.lon
  const originLat = check?.context.origin.lat
  const radiusM = check?.permits_nearby.radius_m
  const didCount = check?.permits_nearby.count
  const lots = data?.lots.features

  const nearRing = useMemo(
    () => (originLon === undefined || originLat === undefined || radiusM === undefined ? null : circleRing({ lon: originLon, lat: originLat }, radiusM)),
    [originLon, originLat, radiusM],
  )
  const near = useMemo<NearYourLot | null>(() => {
    if (!lots || originLon === undefined || originLat === undefined || radiusM === undefined || didCount === undefined) return null
    return { radiusM, couldCount: countFitsNear(lots, { lon: originLon, lat: originLat }, radiusM), didCount }
  }, [lots, originLon, originLat, radiusM, didCount])

  return { nearRing, near }
}
