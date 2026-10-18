import type { BufferGeometry } from 'three'
import type { CheckResponse, ContextBuilding, LocalPoint } from '@contracts/types'
import { loadMapFeatures, type MapFeatures } from './osmMap'
import { placeRoads, roadLayers, type RoadLayers, type RoadPiece } from './roadMesh'
import { extendStreet, roadReach } from './streetExtension'
import type { StreetFrame } from './streetFrame'
import { Pieces, YardKit, type Plant } from './yardKit'
import { furnishYard, planYards } from './yardPlan'

// The drawn look's city round the lot, worked out before the street appears: the map's streets
// (osmMap.ts), the block continued past the data (streetExtension.ts) and every house's yard
// (yardPlan.ts). Each step runs as its own short task, between frames, while the base map flies in:
// done in one go as the lot opened, they held the main thread for about 0.2 s, mid-flight.

/** The map's streets, within this of the lot: the fog hides what lies further. */
export const MAP_RADIUS_M = 520
/** The street waits this long for the map; then it is laid out without it (and the roads come late). */
const MAP_WAIT_MS = 2500

export interface CityRoads {
  pieces: RoadPiece[]
  layers: RoadLayers
}

export interface CityYards {
  geometry: BufferGeometry | null
  plants: Plant[]
}

export interface City {
  lotKey: string
  /** Null without the map (offline, or not yet). */
  roads: CityRoads | null
  extension: { buildings: ContextBuilding[]; trees: LocalPoint[] }
  yards: CityYards
}

/** Lets the frame in progress finish before the next step. */
const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

async function roadsFrom(map: MapFeatures, check: CheckResponse, street: StreetFrame, buildings: ContextBuilding[]): Promise<CityRoads> {
  const placed = placeRoads(map, street, roadReach(street, check.context.buildings), check.lot.polygon_local)
  await nextTask()
  return { pieces: placed.roads, layers: roadLayers(placed.roads, map, placed.shift, buildings, MAP_RADIUS_M) }
}

/**
 * Plans the city for a lot: `ready` once it can be shown (with the map, or without it after
 * MAP_WAIT_MS), `late` with the roads if the map came after that. Abort to drop both.
 */
export async function planCity(
  check: CheckResponse,
  street: StreetFrame,
  signal: AbortSignal,
  ready: (city: City) => void,
  late: (roads: CityRoads) => void,
  withMap: boolean,
): Promise<void> {
  const loading = withMap ? loadMapFeatures(check.context.origin, MAP_RADIUS_M, signal).catch(() => null) : Promise.resolve(null)
  const timeout = new Promise<'late'>((resolve) => setTimeout(() => resolve('late'), MAP_WAIT_MS))
  const first = await Promise.race([loading, timeout])
  const map = first === 'late' ? null : first
  if (signal.aborted) return
  await nextTask()

  // Placed roads keep the continued block and the yards off them.
  const placed = map ? placeRoads(map, street, roadReach(street, check.context.buildings), check.lot.polygon_local) : null
  await nextTask()
  const extension = extendStreet(street, check.context.buildings, check.context.trees, check.context.radius_m, placed?.roads ?? [])
  const buildings = [...check.context.buildings, ...extension.buildings]
  await nextTask()
  const layers = map && placed ? roadLayers(placed.roads, map, placed.shift, buildings, MAP_RADIUS_M) : null
  await nextTask()
  const yards = planYards(buildings, street, check.lot.polygon_local, placed?.roads ?? [])
  const pieces = new Pieces(true)
  const plants: Plant[] = []
  for (const yard of yards) furnishYard(new YardKit(yard.frame, pieces, plants, yard.distance), yard.width, yard.depth, yard.seed)
  const geometry = pieces.empty ? null : pieces.geometry()
  if (signal.aborted) {
    geometry?.dispose()
    Object.values(layers ?? {}).forEach((g) => g?.dispose())
    return
  }
  ready({
    lotKey: check.lot.lot_id,
    roads: placed && layers ? { pieces: placed.roads, layers } : null,
    extension,
    yards: { geometry, plants },
  })

  if (first !== 'late') return
  const lateMap = await loading
  if (!lateMap || signal.aborted) return
  const roads = await roadsFrom(lateMap, check, street, buildings)
  if (signal.aborted) {
    Object.values(roads.layers).forEach((g) => g?.dispose())
    return
  }
  late(roads)
}
