import { VectorTile } from '@mapbox/vector-tile'
import { PbfReader } from 'pbf'
import type { LocalPoint } from '@contracts/types'

// The streets round the lot, from the same OpenStreetMap vector tiles the base map draws
// (OpenFreeMap's OpenMapTiles): every road, lane and driveway, parking aisles (where a parking lot
// is), footpaths, sports fields and playgrounds. The City's data carries only the lot's own
// frontage, so without these the 3D street would have one road. The tiles are the base map's own,
// usually already in the browser's cache; if they cannot be had (offline), the scene keeps its one
// street. Read-only decoration: nothing here enters a result.

const TILEJSON_URL = 'https://tiles.openfreemap.org/planet'
/** The tiles' URL template is versioned weekly; the last one seen is kept for offline use. */
const TEMPLATE_KEY = 'suplex-osm-tile-template'
/** OpenMapTiles' most detailed zoom. */
const ZOOM = 14
const FETCH_TIMEOUT_MS = 4000
/** WGS84, for metres from degrees about the lot. */
const WGS84 = { a: 6378137, e2: 0.00669437999014 }

export type RoadClass =
  | 'motorway'
  | 'trunk'
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'minor'
  | 'service'
  | 'alley'
  | 'driveway'
  | 'parking_aisle'
  | 'path'

export interface MapRoad {
  kind: RoadClass
  line: LocalPoint[]
}

export interface MapArea {
  kind: 'pitch' | 'playground' | 'track'
  ring: LocalPoint[]
  /** A running track's infield, say. */
  holes: LocalPoint[][]
}

export interface MapFeatures {
  roads: MapRoad[]
  areas: MapArea[]
}

function readStored(): string | null {
  try {
    return localStorage.getItem(TEMPLATE_KEY)
  } catch {
    return null
  }
}

function store(template: string): void {
  try {
    localStorage.setItem(TEMPLATE_KEY, template)
  } catch {
    // Private window or blocked storage: the next visit asks again.
  }
}

let template: Promise<string | null> | null = null

function tileTemplate(): Promise<string | null> {
  template ??= fetch(TILEJSON_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((json: { tiles?: string[] }) => {
      const url = json.tiles?.[0] ?? null
      if (url) store(url)
      return url
    })
    .catch(() => readStored())
  return template
}

/** Metres east and north of the origin for a point in degrees (an ellipsoidal local plane). */
function localMetres(origin: { lon: number; lat: number }) {
  const phi = (origin.lat * Math.PI) / 180
  const w = 1 - WGS84.e2 * Math.sin(phi) ** 2
  const n = WGS84.a / Math.sqrt(w)
  const m = (WGS84.a * (1 - WGS84.e2)) / w ** 1.5
  const perLon = (n * Math.cos(phi) * Math.PI) / 180
  const perLat = (m * Math.PI) / 180
  return (lon: number, lat: number): LocalPoint => [(lon - origin.lon) * perLon, (lat - origin.lat) * perLat]
}

const tileX = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z)
const tileY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z)
}

function roadKind(props: Record<string, unknown>): RoadClass | null {
  const cls = String(props.class ?? '')
  if (props.brunnel === 'tunnel') return null
  if (cls === 'service') {
    const service = String(props.service ?? '')
    return service === 'alley' || service === 'driveway' || service === 'parking_aisle' ? service : 'service'
  }
  if (cls === 'path') return ['footway', 'path', 'cycleway', 'pedestrian'].includes(String(props.subclass ?? '')) ? 'path' : null
  return ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor'].includes(cls) ? (cls as RoadClass) : null
}

/** The map features within radiusM of the origin, in local metres; null when the tiles cannot be had. */
export async function loadMapFeatures(origin: { lon: number; lat: number }, radiusM: number, signal: AbortSignal): Promise<MapFeatures | null> {
  const url = await tileTemplate()
  if (!url) return null
  const toLocal = localMetres(origin)
  const dLat = radiusM / 111_000
  const dLon = radiusM / (111_000 * Math.cos((origin.lat * Math.PI) / 180))
  const [x0, x1] = [tileX(origin.lon - dLon, ZOOM), tileX(origin.lon + dLon, ZOOM)]
  const [y0, y1] = [tileY(origin.lat + dLat, ZOOM), tileY(origin.lat - dLat, ZOOM)]
  const tiles: [number, number][] = []
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) tiles.push([x, y])

  const decoded = await Promise.all(
    tiles.map(async ([x, y]) => {
      const response = await fetch(url.replace('{z}', String(ZOOM)).replace('{x}', String(x)).replace('{y}', String(y)), {
        signal: AbortSignal.any([signal, AbortSignal.timeout(FETCH_TIMEOUT_MS)]),
      })
      if (!response.ok) throw new Error(String(response.status))
      return { x, y, tile: new VectorTile(new PbfReader(new Uint8Array(await response.arrayBuffer()))) }
    }),
  ).catch(() => null)
  if (!decoded) return null

  const n = 2 ** ZOOM
  const near = (p: LocalPoint) => Math.hypot(...p) < radiusM
  const roads: MapRoad[] = []
  const areas: MapArea[] = []
  for (const { x, y, tile } of decoded) {
    const point = (extent: number) => (px: number, py: number): LocalPoint => {
      const lon = ((x + px / extent) / n) * 360 - 180
      const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + py / extent)) / n))) * 180) / Math.PI
      return toLocal(lon, lat)
    }
    const transport = tile.layers.transportation
    if (transport) {
      const at = point(transport.extent)
      for (let i = 0; i < transport.length; i++) {
        const f = transport.feature(i)
        if (f.type !== 2) continue
        const kind = roadKind(f.properties)
        if (!kind) continue
        for (const part of f.loadGeometry()) {
          const line = part.map((p) => at(p.x, p.y))
          if (line.length >= 2 && line.some(near)) roads.push({ kind, line })
        }
      }
    }
    const landuse = tile.layers.landuse
    if (landuse) {
      const at = point(landuse.extent)
      for (let i = 0; i < landuse.length; i++) {
        const f = landuse.feature(i)
        const cls = String(f.properties.class ?? '')
        if (f.type !== 3 || (cls !== 'pitch' && cls !== 'playground' && cls !== 'track')) continue
        // An outer ring runs clockwise on screen (positive area, y down); its holes follow it.
        let current: MapArea | null = null
        for (const ring of f.loadGeometry()) {
          if (ring.length < 4) continue
          let twice = 0
          ring.forEach((p, k) => {
            const q = ring[(k + 1) % ring.length]
            twice += p.x * q.y - q.x * p.y
          })
          const local = ring.slice(0, -1).map((p) => at(p.x, p.y))
          if (twice > 0) {
            current = { kind: cls, ring: local, holes: [] }
            if (local.some(near)) areas.push(current)
          } else {
            current?.holes.push(local)
          }
        }
      }
    }
  }
  return { roads, areas }
}
