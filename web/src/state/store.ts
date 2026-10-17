import { create } from 'zustand'
import type { CheckResponse, DesignId, LonLat } from '@contracts/types'
import { check as fetchCheck } from '../api/client'
import { ApiError, type ApiErrorCode } from '../api/errors'
import { defaultDesign } from '../designs'
import { setAddressInUrl } from './url'

// App state (MASTERSPEC 6.1). The ward data, design filter and 2D flag join with J5 and J9.

/** `flying`: the base map is carrying the camera from the city down to the address. */
export type View = 'landing' | 'flying' | 'lot' | 'ward'
export type CheckStatus = 'idle' | 'loading' | 'ready' | 'error'

/** The fly-in from the landing map: where to, and whether the map has got there yet. */
export interface Flight {
  to: LonLat
  arrived: boolean
}

interface AppState {
  view: View
  flight: Flight | null
  addressId: string | null
  /** Kept while the next address loads, so the 3D scene is not torn down in between. */
  check: CheckResponse | null
  checkStatus: CheckStatus
  checkError: ApiErrorCode | null
  designId: DesignId | null
  /** From the landing page, `flyTo` (the search result's position) starts the fly-in. */
  openAddress: (addressId: string, options?: { updateUrl?: boolean; flyTo?: LonLat }) => void
  /** The map reached the address. */
  arrive: () => void
  /** The map settled on the lot: hand over to the 3D scene. */
  land: () => void
  showLanding: (options?: { updateUrl?: boolean }) => void
  setDesign: (designId: DesignId) => void
}

let inflight: AbortController | null = null

export const useApp = create<AppState>()((set, get) => ({
  view: 'landing',
  flight: null,
  addressId: null,
  check: null,
  checkStatus: 'idle',
  checkError: null,
  designId: null,

  openAddress(addressId, { updateUrl = true, flyTo } = {}) {
    if (updateUrl) setAddressInUrl(addressId)
    const { addressId: current, checkStatus, view } = get()
    if (addressId === current && checkStatus !== 'error') {
      if (view !== 'flying') set({ view: 'lot' })
      return
    }
    inflight?.abort()
    const request = (inflight = new AbortController())
    const flight = flyTo && view === 'landing' ? { to: flyTo, arrived: false } : null
    set({ view: flight ? 'flying' : 'lot', flight, addressId, checkStatus: 'loading', checkError: null })
    fetchCheck({ address_id: addressId }, request.signal).then(
      (check) => {
        if (request.signal.aborted) return
        set({ check, checkStatus: 'ready', designId: defaultDesign(check) })
      },
      (error: unknown) => {
        if (request.signal.aborted) return
        const code = error instanceof ApiError ? error.code : 'network'
        set({ check: null, checkStatus: 'error', checkError: code, designId: null })
      },
    )
  },

  arrive() {
    const { flight } = get()
    if (flight && !flight.arrived) set({ flight: { ...flight, arrived: true } })
  },

  land() {
    if (get().view === 'flying') set({ view: 'lot', flight: null })
  },

  showLanding({ updateUrl = true } = {}) {
    inflight?.abort()
    if (updateUrl) setAddressInUrl(null)
    set({
      view: 'landing',
      flight: null,
      addressId: null,
      check: null,
      checkStatus: 'idle',
      checkError: null,
      designId: null,
    })
  },

  setDesign(designId) {
    set({ designId })
  },
}))
