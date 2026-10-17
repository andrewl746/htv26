import { create } from 'zustand'
import type { CheckResponse, DesignId } from '@contracts/types'
import { check as fetchCheck } from '../api/client'
import { ApiError, type ApiErrorCode } from '../api/errors'
import { defaultDesign } from '../designs'
import { setAddressInUrl } from './url'

// App state (MASTERSPEC 6.1). The ward data, design filter and 2D flag join with J5 and J9.

export type View = 'landing' | 'lot' | 'ward'
export type CheckStatus = 'idle' | 'loading' | 'ready' | 'error'

interface AppState {
  view: View
  addressId: string | null
  /** Kept while the next address loads, so the 3D scene is not torn down in between. */
  check: CheckResponse | null
  checkStatus: CheckStatus
  checkError: ApiErrorCode | null
  designId: DesignId | null
  openAddress: (addressId: string, options?: { updateUrl?: boolean }) => void
  showLanding: (options?: { updateUrl?: boolean }) => void
  setDesign: (designId: DesignId) => void
}

let inflight: AbortController | null = null

export const useApp = create<AppState>()((set, get) => ({
  view: 'landing',
  addressId: null,
  check: null,
  checkStatus: 'idle',
  checkError: null,
  designId: null,

  openAddress(addressId, { updateUrl = true } = {}) {
    if (updateUrl) setAddressInUrl(addressId)
    const { addressId: current, checkStatus } = get()
    if (addressId === current && checkStatus !== 'error') {
      set({ view: 'lot' })
      return
    }
    inflight?.abort()
    const request = (inflight = new AbortController())
    set({ view: 'lot', addressId, checkStatus: 'loading', checkError: null })
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

  showLanding({ updateUrl = true } = {}) {
    inflight?.abort()
    if (updateUrl) setAddressInUrl(null)
    set({ view: 'landing', addressId: null, check: null, checkStatus: 'idle', checkError: null, designId: null })
  },

  setDesign(designId) {
    set({ designId })
  },
}))
