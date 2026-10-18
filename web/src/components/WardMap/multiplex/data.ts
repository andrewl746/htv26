import { useEffect, useState } from 'react'
import type { Feature, Geometry, Point } from 'geojson'
import permitsUrl from '../../../../../pipeline/snapshots/multiplexes.geojson?url'
import wardsUrl from '../../../../../pipeline/snapshots/multiplex_wards.geojson?url'
import { pending } from '../../../copy'
import { WARD_IDS } from './filters'
import type { MultiplexCollection, MultiplexProps, WardShape, WardShapeCollection } from './types'

// The permitted-multiplexes layer's data: two static snapshots from /pipeline/snapshots.

const TIMEOUT_MS = 30_000

export interface MultiplexMeta {
  /** ISO timestamp the snapshot was built. */
  generatedAt: string
  /** ISO timestamp the City's files were fetched. */
  fetchedAt: string
  /** Permit points that loaded (malformed ones dropped). */
  total: number
}

export interface MultiplexData {
  permits: MultiplexCollection
  wards: WardShapeCollection
  meta: MultiplexMeta
}

export type MultiplexLoad =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: MultiplexData }

interface RawFile {
  generated_at?: unknown
  source_dates?: { fetched_at?: unknown }
  features?: unknown
}

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]) })
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  return (await response.json()) as T
}

const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function featuresOf(raw: RawFile): Feature[] {
  if (!Array.isArray(raw.features)) throw new Error('not a feature collection')
  return raw.features as Feature[]
}

function isPoint(g: Geometry | null | undefined): g is Point {
  return g?.type === 'Point' && Array.isArray(g.coordinates) && g.coordinates.length >= 2 && g.coordinates.every(isCount)
}

/** A permit point survives only if its geometry and every property it is used for are sound. */
function isPermit(f: Feature): f is Feature<Point, MultiplexProps> {
  const p = f?.properties as Partial<MultiplexProps> | null | undefined
  return (
    !!p &&
    isPoint(f.geometry) &&
    isCount(p.id) &&
    isText(p.street) &&
    isText(p.ward) &&
    WARD_IDS.includes(p.ward) &&
    isCount(p.units) &&
    (p.structure === 'detached' || p.structure === 'semi' || p.structure === 'townhouse' || p.structure === 'other') &&
    (p.work === 'new_build' || p.work === 'conversion') &&
    (p.status === 'active' || p.status === 'cleared') &&
    isText(p.issued)
  )
}

function isWard(f: Feature): f is Feature<Geometry, WardShape> {
  const p = f?.properties as Partial<WardShape> | null | undefined
  return !!p && !!f.geometry && isText(p.ward) && WARD_IDS.includes(p.ward) && typeof p.name === 'string'
}

async function load(signal: AbortSignal): Promise<MultiplexData> {
  const [rawPermits, rawWards] = await Promise.all([getJson<RawFile>(permitsUrl, signal), getJson<RawFile>(wardsUrl, signal)])
  const permits: MultiplexCollection = { type: 'FeatureCollection', features: featuresOf(rawPermits).filter(isPermit) }
  const wards: WardShapeCollection = { type: 'FeatureCollection', features: featuresOf(rawWards).filter(isWard) }
  return {
    permits,
    wards,
    meta: {
      generatedAt: isText(rawPermits.generated_at) ? rawPermits.generated_at : '',
      fetchedAt: isText(rawPermits.source_dates?.fetched_at) ? rawPermits.source_dates.fetched_at : '',
      total: permits.features.length,
    },
  }
}

// One load is shared by every component that asks for it (the map and the nearby-permits section):
// the snapshots are fetched once per page. A failed load is forgotten so the next mount retries.
let shared: Promise<MultiplexData> | null = null
let loaded: MultiplexData | null = null

function loadShared(): Promise<MultiplexData> {
  if (!shared) {
    shared = load(new AbortController().signal).then(
      (data) => {
        loaded = data
        return data
      },
      (error: unknown) => {
        shared = null
        throw error
      },
    )
  }
  return shared
}

/** Loads the permit points and the ward shapes together (once; later callers reuse the result). */
export function useMultiplexData(): MultiplexLoad {
  const [state, setState] = useState<MultiplexLoad>(() => (loaded ? { status: 'ready', data: loaded } : { status: 'loading' }))

  useEffect(() => {
    let active = true
    loadShared().then(
      (data) => {
        if (active) setState({ status: 'ready', data })
      },
      () => {
        if (active) setState({ status: 'error', message: pending.load_error })
      },
    )
    return () => {
      active = false
    }
  }, [])

  return state
}
