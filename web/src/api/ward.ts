import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { DesignKey, LotFeatureProps, Result, TrendResponse, WardResponse } from '@contracts/types'
import lotsFixtureUrl from '@contracts/fixtures/lots.04.sample.geojson?url'
import permitsFixtureUrl from '@contracts/fixtures/permits.sample.geojson?url'
import type { Bounds, LotCollection, LotProps, PermitCollection, WardData } from '../components/WardMap/data'
import { getApiJson } from './client'
import { API_BASE } from './config'

// One ward's numbers, lots and permit points (MASTERSPEC 6.5), loaded once and shared by the ward
// map and the lot-to-ward transition on the base map, through the same fetch wrapper as the check
// so the demo cache answers when the API does not. The shape is Yuvi's WardData (WardMap/data.ts):
// `flatten` and `boundsOf` do what his loader does, so his components draw it unchanged.

/** The lot file is several megabytes; it gets longer than the 3 s the small calls get. */
const STATIC_TIMEOUT_MS = 15_000

type RawLots = FeatureCollection<Geometry, LotFeatureProps>

/** Adds `rfn`, `rfw`, `rsn` and `rsw` beside the nested `r`, which map expressions cannot reach. */
function flatten(raw: RawLots): LotCollection {
  return {
    type: 'FeatureCollection',
    features: raw.features.map((f): Feature<Geometry, LotProps> => {
      const r: Partial<Record<DesignKey, Result>> = f.properties.r ?? {}
      return {
        ...f,
        properties: {
          ...f.properties,
          rfn: r.fn ?? 'not_checked',
          rfw: r.fw ?? 'not_checked',
          rsn: r.sn ?? 'not_checked',
          rsw: r.sw ?? 'not_checked',
        },
      }
    }),
  }
}

/** Permit points get their id at the top level too, so the transition can address each dot. */
function withIds(permits: PermitCollection): PermitCollection {
  return { ...permits, features: permits.features.map((f) => ({ ...f, id: f.properties.id })) }
}

function extend(box: number[], coords: unknown): void {
  if (!Array.isArray(coords)) return
  if (typeof coords[0] === 'number') {
    const [x, y] = coords as number[]
    box[0] = Math.min(box[0], x)
    box[1] = Math.min(box[1], y)
    box[2] = Math.max(box[2], x)
    box[3] = Math.max(box[3], y)
    return
  }
  for (const part of coords) extend(box, part)
}

function boundsOf(lots: LotCollection): Bounds {
  const box = [Infinity, Infinity, -Infinity, -Infinity]
  for (const f of lots.features) extend(box, (f.geometry as { coordinates?: unknown }).coordinates)
  return [
    [box[0], box[1]],
    [box[2], box[3]],
  ]
}

/** The trend is an extra: when it is missing or slow, the rest of the ward still shows. */
async function optionalTrend(load: () => Promise<TrendResponse>): Promise<TrendResponse | null> {
  try {
    const trend = await load()
    return Array.isArray(trend.series) ? { ...trend, markers: trend.markers ?? [] } : null
  } catch {
    return null
  }
}

async function fetchFixture<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  return (await response.json()) as T
}

async function loadFixtures(wardId: string) {
  const ward = (await import('@contracts/fixtures/ward.04.json')).default as unknown as WardResponse
  if (ward.ward_id !== wardId) throw new Error(`the fixtures only cover ward ${ward.ward_id}`)
  const [lots, permits, trend] = await Promise.all([
    fetchFixture<RawLots>(lotsFixtureUrl),
    fetchFixture<PermitCollection>(permitsFixtureUrl),
    optionalTrend(async () => (await import('@contracts/fixtures/trend.04.json')).default as unknown as TrendResponse),
  ])
  return { ward, lots, permits, trend }
}

async function loadLive(wardId: string) {
  const ward = await getApiJson<WardResponse>(`/ward/${wardId}`)
  const [lots, permits, trend] = await Promise.all([
    getApiJson<RawLots>(ward.lots_url, { timeoutMs: STATIC_TIMEOUT_MS }),
    getApiJson<PermitCollection>(ward.permits_url, { timeoutMs: STATIC_TIMEOUT_MS }),
    optionalTrend(() => getApiJson<TrendResponse>(ward.trend_url)),
  ])
  return { ward, lots, permits, trend }
}

const loaded = new Map<string, Promise<WardData>>()

/** One ward's data; asked twice, it loads once. A failed load can be asked again. */
export function loadWard(wardId: string): Promise<WardData> {
  let promise = loaded.get(wardId)
  if (!promise) {
    promise = (API_BASE === null ? loadFixtures(wardId) : loadLive(wardId)).then(({ ward, lots, permits, trend }) => {
      const flat = flatten(lots)
      return { ward, lots: flat, permits: withIds(permits), trend, bounds: boundsOf(flat) }
    })
    promise.catch(() => loaded.delete(wardId))
    loaded.set(wardId, promise)
  }
  return promise
}
