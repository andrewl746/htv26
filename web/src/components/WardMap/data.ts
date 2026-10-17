import { useEffect, useState } from 'react'
import type { Feature, FeatureCollection, Geometry, Point } from 'geojson'
import type { DesignKey, LotFeatureProps, PermitFeatureProps, Result, TrendResponse, WardResponse } from '@contracts/types'
import { API_BASE } from '../../api/config'
import lotsFixtureUrl from '@contracts/fixtures/lots.04.sample.geojson?url'
import permitsFixtureUrl from '@contracts/fixtures/permits.sample.geojson?url'
import { pending } from '../../copy'

// The ward map's data (MASTERSPEC 6.5): the ward's numbers, its lots and the permit points. With
// no API base the fixtures stand in; they cover Ward 04 only.

/** The lot file is large, so it gets longer than the 3 s the small calls get. */
const STATIC_TIMEOUT_MS = 30_000
const SMALL_TIMEOUT_MS = 8_000

export type LotProps = LotFeatureProps & Record<`r${DesignKey}`, Result>
export type LotCollection = FeatureCollection<Geometry, LotProps>
export type PermitCollection = FeatureCollection<Point, PermitFeatureProps>
export type Bounds = [[number, number], [number, number]]

export interface WardData {
  ward: WardResponse
  lots: LotCollection
  permits: PermitCollection
  /** Permits per month for the trend chart; null when the trend did not load (the chart then hides). */
  trend: TrendResponse | null
  /** The lots' bounding box (south-west and north-east corners): the ward's extent. */
  bounds: Bounds
}

export type WardLoad =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: WardData }

type RawLots = FeatureCollection<Geometry, LotFeatureProps>

/** Adds `rfn`, `rfw`, `rsn` and `rsw` beside the nested `r`, which expressions cannot reach. */
function flatten(raw: RawLots): LotCollection {
  return {
    type: 'FeatureCollection',
    features: raw.features.map((f): Feature<Geometry, LotProps> => {
      // A lot that was not checked may arrive without per-design results; it reads as not checked.
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

function extend(box: [number, number, number, number], coords: unknown): void {
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
  const box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const f of lots.features) extend(box, (f.geometry as { coordinates?: unknown }).coordinates)
  return [[box[0], box[1]], [box[2], box[3]]]
}

async function getJson<T>(url: string, timeoutMs: number, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) })
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  return (await response.json()) as T
}

interface Loaded {
  ward: WardResponse
  lots: RawLots
  permits: PermitCollection
  trend: TrendResponse | null
}

/** The trend is an extra: if it is missing or slow, the rest of the ward still shows. */
async function getTrend(url: () => Promise<TrendResponse>): Promise<TrendResponse | null> {
  try {
    const trend = await url()
    return Array.isArray(trend.series) ? { ...trend, markers: trend.markers ?? [] } : null
  } catch {
    return null
  }
}

async function loadFixtures(wardId: string, signal: AbortSignal): Promise<Loaded> {
  const ward = (await import('@contracts/fixtures/ward.04.json')).default as unknown as WardResponse
  if (ward.ward_id !== wardId) throw new Error(`the fixtures only cover ward ${ward.ward_id}`)
  const [lots, permits, trend] = await Promise.all([
    getJson<RawLots>(lotsFixtureUrl, SMALL_TIMEOUT_MS, signal),
    getJson<PermitCollection>(permitsFixtureUrl, SMALL_TIMEOUT_MS, signal),
    getTrend(async () => (await import('@contracts/fixtures/trend.04.json')).default as unknown as TrendResponse),
  ])
  return { ward, lots, permits, trend }
}

async function loadLive(wardId: string, signal: AbortSignal): Promise<Loaded> {
  const ward = await getJson<WardResponse>(`${API_BASE}/ward/${wardId}`, SMALL_TIMEOUT_MS, signal)
  const [lots, permits, trend] = await Promise.all([
    getJson<RawLots>(`${API_BASE}${ward.lots_url}`, STATIC_TIMEOUT_MS, signal),
    getJson<PermitCollection>(`${API_BASE}${ward.permits_url}`, STATIC_TIMEOUT_MS, signal),
    getTrend(() => getJson<TrendResponse>(`${API_BASE}${ward.trend_url}`, SMALL_TIMEOUT_MS, signal)),
  ])
  return { ward, lots, permits, trend }
}

/** Loads one ward's numbers, lots and permit points together. */
export function useWardData(wardId: string): WardLoad {
  const [state, setState] = useState<{ wardId: string; load: WardLoad }>({ wardId, load: { status: 'loading' } })

  useEffect(() => {
    const request = new AbortController()
    const source: Promise<Loaded> = API_BASE === null ? loadFixtures(wardId, request.signal) : loadLive(wardId, request.signal)
    source.then(
      ({ ward, lots, permits, trend }) => {
        if (request.signal.aborted) return
        const flat = flatten(lots)
        setState({ wardId, load: { status: 'ready', data: { ward, lots: flat, permits, trend, bounds: boundsOf(flat) } } })
      },
      () => {
        if (!request.signal.aborted) setState({ wardId, load: { status: 'error', message: pending.load_error } })
      },
    )
    return () => request.abort()
  }, [wardId])

  // A ward switch shows the loading state until its own data arrives, never the last ward's.
  return state.wardId === wardId ? state.load : { status: 'loading' }
}
