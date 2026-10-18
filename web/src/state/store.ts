import { create } from 'zustand'
import type { CheckResponse, DesignId, Lang } from '@contracts/types'
import { check as fetchCheck } from '../api/client'
import { ApiError, type ApiErrorCode } from '../api/errors'
import { defaultDesign } from '../designs'
import { setAddressInUrl } from './url'

// App state (MASTERSPEC 6.1). The ward data, design filter and 2D flag join with J5 and J9.

/**
 * `flying`: the base map is carrying the camera from the city to the lot. It waits for the check
 * (tens of milliseconds from the local API) so it can fly once, straight to the lot's rest view.
 */
export type View = 'landing' | 'flying' | 'lot' | 'ward'
export type CheckStatus = 'idle' | 'loading' | 'ready' | 'error'

interface AppState {
  view: View
  /** The last stretch of the flight, when the 3D scene fades in over the still-moving map. */
  handoff: boolean
  addressId: string | null
  /** Kept while the next address loads, so the 3D scene is not torn down in between. */
  check: CheckResponse | null
  checkStatus: CheckStatus
  checkError: ApiErrorCode | null
  designId: DesignId | null
  /** The language of the explanation, and of the ward briefing it links to. */
  lang: Lang
  /** `fly` from the landing page starts the flight; anywhere else the check opens directly. */
  openAddress: (addressId: string, options?: { updateUrl?: boolean; fly?: boolean }) => void
  /** The flight is nearly down: start fading the 3D scene in. */
  beginHandoff: () => void
  /** The map has landed on the lot: hand over to the 3D scene. */
  land: () => void
  showLanding: (options?: { updateUrl?: boolean }) => void
  setDesign: (designId: DesignId) => void
  setLang: (lang: Lang) => void
}

let inflight: AbortController | null = null

export const useApp = create<AppState>()((set, get) => ({
  view: 'landing',
  handoff: false,
  addressId: null,
  check: null,
  checkStatus: 'idle',
  checkError: null,
  designId: null,
  lang: 'en',

  openAddress(addressId, { updateUrl = true, fly = false } = {}) {
    if (updateUrl) setAddressInUrl(addressId)
    const { addressId: current, checkStatus, view } = get()
    if (addressId === current && checkStatus !== 'error') {
      if (view !== 'flying') set({ view: 'lot' })
      return
    }
    inflight?.abort()
    const request = (inflight = new AbortController())
    set({
      view: fly && view === 'landing' ? 'flying' : 'lot',
      handoff: false,
      addressId,
      checkStatus: 'loading',
      checkError: null,
    })
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

  beginHandoff() {
    if (get().view === 'flying') set({ handoff: true })
  },

  land() {
    if (get().view === 'flying') set({ view: 'lot', handoff: false })
  },

  showLanding({ updateUrl = true } = {}) {
    inflight?.abort()
    if (updateUrl) setAddressInUrl(null)
    set({
      view: 'landing',
      handoff: false,
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

  setLang(lang) {
    set({ lang })
  },
}))
