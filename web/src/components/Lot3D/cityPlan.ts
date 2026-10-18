import type { BufferGeometry } from 'three'
import type { CheckResponse, ContextBuilding, LocalPoint } from '@contracts/types'
import { loadMapFeatures, type MapFeatures } from './osmMap'
import { placeRoads, roadLayers, type FrontageStreet, type RoadLayers, type RoadPiece } from './roadMesh'
import { extendStreet, roadReach } from './streetExtension'
import type { StreetFrame } from './streetFrame'
import { Pieces, YardKit, type Plant } from './yardKit'
import { furnishYard, planYards } from './yardPlan'

// The drawn look's city round the lot, worked out before the street appears: the map's streets
// (osmMap.ts), the block continued past the data (streetExtension.ts) and every house's yard
// (yardPlan.ts). Each step runs as its own short task, between frames, while the base map flies in:
// done in one go as the lot opened, they held the main thread for about 0.2 s, mid-flight. A lot
// with no frontage (one Suplex does not check) has no street to continue or yards to face it, but
// still gets the map's streets.

/** The ground reaches well past the 150 m context so its edge is always lost in the fog. */
const GROUND_SCALE = 4

/** The ground's radius round the lot; the map's streets run out to its edge. */
export function groundRadiusM(contextRadiusM: number): number {
  return contextRadiusM * GROUND_SCALE
}
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

const NO_EXTENSION: City['extension'] = { buildings: [], trees: [] }

/** The lot's own street, which the frontage road draws; none without a frontage. */
function frontageOf(check: CheckResponse, street: StreetFrame | null): FrontageStreet | null {
  return street ? { street, reach: roadReach(street, check.context.buildings) } : null
}

async function roadsFrom(map: MapFeatures, check: CheckResponse, street: StreetFrame | null, buildings: ContextBuilding[]): Promise<CityRoads> {
  const radiusM = groundRadiusM(check.context.radius_m)
  const placed = placeRoads(map, frontageOf(check, street), check.lot.polygon_local, radiusM)
  await nextTask()
  return { pieces: placed.roads, layers: roadLayers(placed.roads, map, placed.shift, buildings, radiusM) }
}

/** Every house's yard, clear of the roads (and of the lot's own street); none without a frontage. */
function yardsFor(check: CheckResponse, street: StreetFrame | null, buildings: ContextBuilding[], roads: RoadPiece[]): CityYards {
  const frontage = frontageOf(check, street)
  const yards = frontage ? planYards(buildings, frontage.street, check.lot.polygon_local, roads, frontage.reach) : []
  const pieces = new Pieces(true)
  const plants: Plant[] = []
  for (const yard of yards) furnishYard(new YardKit(yard.frame, pieces, plants, yard.distance), yard.width, yard.depth, yard.seed)
  return { geometry: pieces.empty ? null : pieces.geometry(), plants }
}

/**
 * Plans the city for a lot: `ready` once it can be shown (with the map, or without it after
 * MAP_WAIT_MS), `late` with the roads and the yards planned again clear of them if the map came
 * after that. Abort to drop both.
 */
export async function planCity(
  check: CheckResponse,
  /** The street in front of the lot; null when the lot has no frontage. */
  street: StreetFrame | null,
  signal: AbortSignal,
  ready: (city: City) => void,
  late: (roads: CityRoads, yards: CityYards) => void,
  withMap: boolean,
): Promise<void> {
  const radiusM = groundRadiusM(check.context.radius_m)
  const loading = withMap ? loadMapFeatures(check.context.origin, radiusM, signal).catch(() => null) : Promise.resolve(null)
  const timeout = new Promise<'late'>((resolve) => setTimeout(() => resolve('late'), MAP_WAIT_MS))
  const first = await Promise.race([loading, timeout])
  const map = first === 'late' ? null : first
  if (signal.aborted) return
  await nextTask()

  // Placed roads keep the continued block and the yards off them.
  const placed = map ? placeRoads(map, frontageOf(check, street), check.lot.polygon_local, radiusM) : null
  await nextTask()
  const extension = street
    ? extendStreet(street, check.context.buildings, check.context.trees, check.context.radius_m, placed?.roads ?? [])
    : NO_EXTENSION
  const buildings = [...check.context.buildings, ...extension.buildings]
  await nextTask()
  const layers = map && placed ? roadLayers(placed.roads, map, placed.shift, buildings, radiusM) : null
  await nextTask()
  const yards = yardsFor(check, street, buildings, placed?.roads ?? [])
  if (signal.aborted) {
    yards.geometry?.dispose()
    Object.values(layers ?? {}).forEach((g) => g?.dispose())
    return
  }
  ready({
    lotKey: check.lot.lot_id,
    roads: placed && layers ? { pieces: placed.roads, layers } : null,
    extension,
    yards,
  })

  if (first !== 'late') return
  const lateMap = await loading
  if (!lateMap || signal.aborted) return
  const roads = await roadsFrom(lateMap, check, street, buildings)
  await nextTask()
  // Planned without the roads, the yards would run over them: planned again, clear of them.
  const lateYards = yardsFor(check, street, buildings, roads.pieces)
  if (signal.aborted) {
    Object.values(roads.layers).forEach((g) => g?.dispose())
    lateYards.geometry?.dispose()
    return
  }
  late(roads, lateYards)
}
