import { create } from 'zustand'
import type { CheckResponse, DesignId, Lang } from '@contracts/types'
import { check as fetchCheck, type CheckQuery } from '../api/client'
import { ApiError, type ApiErrorCode } from '../api/errors'
import { loadWard as fetchWard } from '../api/ward'
import type { WardData } from '../components/WardMap/data'
import { HAS_WEBGL } from '../graphics'
import { defaultDesign } from '../designs'
import { setAddressInUrl, setLotInUrl, setViewInUrl, setWardInUrl } from './url'

// App state (MASTERSPEC 6.1). The ward map keeps its own design filter.

/**
 * `flying`: the base map is carrying the camera from the city to the lot. It waits for the check
 * (tens of milliseconds from the local API) so it can fly once, straight to the lot's rest view.
 */
/** `toWard` and `toLot`: the base map carrying the camera between the lot and its ward (MASTERSPEC 6.6). */
export type View = 'landing' | 'flying' | 'lot' | 'plan' | 'toWard' | 'ward' | 'toLot'
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
  /** That ward's numbers, lots and permits, loaded in the background during the address check. */
  wardData: WardData | null
  wardStatus: CheckStatus
  /** The language of the explanation, and of the ward briefing it links to. */
  lang: Lang
  /**
   * False without WebGL, or once the 3D scene or a map has crashed: the app then shows each
   * address check on the plan view, with no maps (MASTERSPEC 6.7).
   */
  graphics: boolean
  /** `fly` from the landing page starts the flight; anywhere else the check opens directly. */
  openAddress: (addressId: string, options?: { updateUrl?: boolean; fly?: boolean }) => void
  /** A lot clicked on the ward map opens its address check, as if it had been searched (MASTERSPEC 6.5). */
  openLot: (lotId: string, options?: { updateUrl?: boolean }) => void
  /** The flight (from the city or back from the ward) is nearly down: start fading the 3D scene in. */
  beginHandoff: () => void
  /** The map has landed on the lot: hand over to the 3D scene. */
  land: () => void
  /** Loads a ward's data unless it is loaded or loading. */
  loadWard: (wardId: string) => void
  /** The transition has reached the ward: show the ward map and its panel. */
  arriveWard: () => void
  showLanding: (options?: { updateUrl?: boolean }) => void
  /** The plan view: the same check seen from above, with the permits round it. Needs a check. */
  showPlan: (options?: { updateUrl?: boolean }) => void
  /** Back from the plan view to the 3D lot. */
  showLot: (options?: { updateUrl?: boolean }) => void
  /**
   * "See your ward" (MASTERSPEC 6.4): the checked lot's ward, or `wardId` when there is no lot.
   * From the 3D lot it plays the transition; from a URL it opens directly.
   */
  showWard: (options?: { updateUrl?: boolean; wardId?: string }) => void
  /** "Back to your lot": the transition back to the 3D lot (MASTERSPEC 6.6). */
  backToLot: () => void
  setDesign: (designId: DesignId) => void
  setLang: (lang: Lang) => void
  /** The 3D scene or a map failed: carry on without them. */
  graphicsFailed: () => void
}

let inflight: AbortController | null = null

/**
 * The ward data loads in the background while the user looks at the lot (MASTERSPEC 6.4, 6.6), but
 * only once the 3D sequence has played: parsing the lot file takes tens of milliseconds on the
 * main thread, which would show as a stutter mid-sequence. "See your ward" loads it at once.
 */
const WARD_PREFETCH_DELAY_MS = 9000
let prefetchTimer = 0

function prefetchWard(wardId: string): void {
  window.clearTimeout(prefetchTimer)
  prefetchTimer = window.setTimeout(() => {
    const load = () => useApp.getState().loadWard(wardId)
    if ('requestIdleCallback' in window) window.requestIdleCallback(load, { timeout: 2000 })
    else load()
  }, WARD_PREFETCH_DELAY_MS)
}

/** Starts a check unless the same one is already open; `fly` from the landing page starts the flight. */
function openCheck(query: CheckQuery, fly: boolean): void {
  const key = 'address_id' in query ? `a:${query.address_id}` : `lot:${query.lot_id}`
  const { checkKey, checkStatus, view, graphics } = useApp.getState()
  // Without the 3D scene an address check opens on the plan view.
  const lotView = graphics ? 'lot' : 'plan'
  if (key === checkKey && checkStatus !== 'error') {
    if (view !== 'flying') useApp.setState({ view: lotView })
    return
  }
  inflight?.abort()
  const request = (inflight = new AbortController())
  useApp.setState({
    view: fly && view === 'landing' && graphics ? 'flying' : lotView,
    handoff: false,
    checkKey: key,
    checkStatus: 'loading',
    checkError: null,
  })
  fetchCheck(query, request.signal).then(
    (check) => {
      if (request.signal.aborted) return
      useApp.setState({ check, checkStatus: 'ready', designId: defaultDesign(check), wardId: check.lot.ward_id })
      prefetchWard(check.lot.ward_id)
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
  wardData: null,
  wardStatus: 'idle',
  lang: 'en',
  graphics: HAS_WEBGL,

  openAddress(addressId, { updateUrl = true, fly = false } = {}) {
    if (updateUrl) setAddressInUrl(addressId)
    openCheck({ address_id: addressId }, fly)
  },

  openLot(lotId, { updateUrl = true } = {}) {
    if (updateUrl) setLotInUrl(lotId)
    openCheck({ lot_id: lotId }, false)
  },

  beginHandoff() {
    const { view } = get()
    if (view === 'flying' || view === 'toLot') set({ handoff: true })
  },

  land() {
    const { view } = get()
    if (view === 'flying' || view === 'toLot') set({ view: 'lot', handoff: false })
  },

  loadWard(wardId) {
    const { wardData, wardStatus, wardId: current } = get()
    if (wardId === current && (wardStatus === 'loading' || (wardStatus === 'ready' && wardData?.ward.ward_id === wardId))) return
    set({ wardId, wardStatus: 'loading' })
    fetchWard(wardId).then(
      (data) => {
        if (get().wardId === wardId) set({ wardData: data, wardStatus: 'ready' })
      },
      () => {
        if (get().wardId === wardId) set({ wardStatus: 'error' })
      },
    )
  },

  arriveWard() {
    if (get().view === 'toWard') set({ view: 'ward' })
  },

  showLanding({ updateUrl = true } = {}) {
    inflight?.abort()
    window.clearTimeout(prefetchTimer)
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
    if (!get().checkKey || !get().graphics) return
    if (updateUrl) setViewInUrl(null)
    set({ view: 'lot' })
  },

  showWard({ updateUrl = true, wardId } = {}) {
    const { check, view, graphics } = get()
    const ward = wardId ?? check?.lot.ward_id ?? get().wardId
    if (!ward || !graphics) return
    if (updateUrl) setWardInUrl(ward)
    window.clearTimeout(prefetchTimer)
    get().loadWard(ward)
    // The transition starts from the 3D lot of this ward; anything else switches at once.
    const animate = updateUrl && view === 'lot' && check?.lot.ward_id === ward
    set({ view: animate ? 'toWard' : 'ward', handoff: false })
  },

  backToLot() {
    if (!get().checkKey) return
    setWardInUrl(null)
    set({ view: get().check ? 'toLot' : 'lot', handoff: false })
  },

  setDesign(designId) {
    set({ designId })
  },

  setLang(lang) {
    set({ lang })
  },

  graphicsFailed() {
    const { view, checkKey } = get()
    if (view === 'landing') set({ graphics: false, handoff: false })
    else set({ graphics: false, handoff: false, view: checkKey ? 'plan' : 'landing' })
  },
}))
