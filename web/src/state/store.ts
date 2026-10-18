import { create } from 'zustand'
import type { CheckResponse, DesignId, Lang } from '@contracts/types'
import { check as fetchCheck, type CheckQuery } from '../api/client'
import { ApiError, type ApiErrorCode } from '../api/errors'
import { defaultDesign } from '../designs'
import { setAddressInUrl, setLotInUrl, setViewInUrl, setWardInUrl } from './url'

// App state (MASTERSPEC 6.1). The ward map keeps its own design filter.

/**
 * `flying`: the base map is carrying the camera from the city to the lot. It waits for the check
 * (tens of milliseconds from the local API) so it can fly once, straight to the lot's rest view.
 */
export type View = 'landing' | 'flying' | 'lot' | 'plan' | 'ward'
export type CheckStatus = 'idle' | 'loading' | 'ready' | 'error'

interface AppState {
  view: View
  /** The last stretch of the flight, when the 3D scene fades in over the still-moving map. */
  handoff: boolean
  /** What the check was asked for: `a:<address_id>` or `lot:<lot_id>`. */
  checkKey: string | null
  /** Kept while the next address loads, so the 3D scene is not torn down in between. */
  check: CheckResponse | null
  checkStatus: CheckStatus
  checkError: ApiErrorCode | null
  designId: DesignId | null
  /** The ward on the ward view: the checked lot's, or one named in the URL without a lot. */
  wardId: string | null
  /** The language of the explanation, and of the ward briefing it links to. */
  lang: Lang
  /** `fly` from the landing page starts the flight; anywhere else the check opens directly. */
  openAddress: (addressId: string, options?: { updateUrl?: boolean; fly?: boolean }) => void
  /** A lot clicked on the ward map opens its address check, as if it had been searched (MASTERSPEC 6.5). */
  openLot: (lotId: string, options?: { updateUrl?: boolean }) => void
  /** The flight is nearly down: start fading the 3D scene in. */
  beginHandoff: () => void
  /** The map has landed on the lot: hand over to the 3D scene. */
  land: () => void
  showLanding: (options?: { updateUrl?: boolean }) => void
  /** The plan view: the same check seen from above, with the permits round it. Needs a check. */
  showPlan: (options?: { updateUrl?: boolean }) => void
  /** Back from the plan view to the 3D lot. */
  showLot: (options?: { updateUrl?: boolean }) => void
  /** "See your ward" (MASTERSPEC 6.4): the checked lot's ward, or `wardId` when there is no lot. */
  showWard: (options?: { updateUrl?: boolean; wardId?: string }) => void
  setDesign: (designId: DesignId) => void
  setLang: (lang: Lang) => void
}

let inflight: AbortController | null = null

/** Starts a check unless the same one is already open; `fly` from the landing page starts the flight. */
function openCheck(query: CheckQuery, fly: boolean): void {
  const key = 'address_id' in query ? `a:${query.address_id}` : `lot:${query.lot_id}`
  const { checkKey, checkStatus, view } = useApp.getState()
  if (key === checkKey && checkStatus !== 'error') {
    if (view !== 'flying') useApp.setState({ view: 'lot' })
    return
  }
  inflight?.abort()
  const request = (inflight = new AbortController())
  useApp.setState({
    view: fly && view === 'landing' ? 'flying' : 'lot',
    handoff: false,
    checkKey: key,
    checkStatus: 'loading',
    checkError: null,
  })
  fetchCheck(query, request.signal).then(
    (check) => {
      if (request.signal.aborted) return
      useApp.setState({ check, checkStatus: 'ready', designId: defaultDesign(check), wardId: check.lot.ward_id })
    },
    (error: unknown) => {
      if (request.signal.aborted) return
      const code = error instanceof ApiError ? error.code : 'network'
      useApp.setState({ check: null, checkStatus: 'error', checkError: code, designId: null })
    },
  )
}

export const useApp = create<AppState>()((set, get) => ({
  view: 'landing',
  handoff: false,
  checkKey: null,
  check: null,
  checkStatus: 'idle',
  checkError: null,
  designId: null,
  wardId: null,
  lang: 'en',

  openAddress(addressId, { updateUrl = true, fly = false } = {}) {
    if (updateUrl) setAddressInUrl(addressId)
    openCheck({ address_id: addressId }, fly)
  },

  openLot(lotId, { updateUrl = true } = {}) {
    if (updateUrl) setLotInUrl(lotId)
    openCheck({ lot_id: lotId }, false)
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
      checkKey: null,
      check: null,
      checkStatus: 'idle',
      checkError: null,
      designId: null,
      wardId: null,
    })
  },

  showPlan({ updateUrl = true } = {}) {
    if (!get().checkKey) return
    if (updateUrl) setViewInUrl('plan')
    set({ view: 'plan', handoff: false })
  },

  showLot({ updateUrl = true } = {}) {
    if (!get().checkKey) return
    if (updateUrl) setViewInUrl(null)
    set({ view: 'lot' })
  },

  showWard({ updateUrl = true, wardId } = {}) {
    const ward = wardId ?? get().check?.lot.ward_id ?? get().wardId
    if (!ward) return
    if (updateUrl) setWardInUrl(ward)
    set({ view: 'ward', handoff: false, wardId: ward })
  },

  setDesign(designId) {
    set({ designId })
  },

  setLang(lang) {
    set({ lang })
  },
}))
