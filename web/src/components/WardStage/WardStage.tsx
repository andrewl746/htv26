import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { fill, formatNumber, labels } from '../../copy'
import { PANEL_WIDTH_PX } from '../../layout'
import { useApp } from '../../state/store'
import { Blueprint } from '../Landing/Blueprint'
import { wardCopy } from '../WardMap/copy'
import { DesignFilterControl } from '../WardMap/DesignFilterControl'
import { isDisabled, type DesignFilter } from '../WardMap/designs'
import { Legend } from '../WardMap/Legend'
import { useNearYourLot } from '../WardMap/useNearYourLot'
import { WardMapCanvas } from '../WardMap/WardMapCanvas'
import { WardPanel } from '../WardMap/WardPanel'
import '../WardMap/wardMap.css'
import { NumberMarks } from './NumberMarks'
import './wardStage.css'

/**
 * The ward view (MASTERSPEC 6.5, 6.6): Yuvi's ward map, put together from its parts the way his
 * WardMap.tsx does, so the transition can time them. The map is built underneath, hidden, as soon
 * as the ward data is in, so when the base map's flight reaches the ward it takes over on the very
 * same view; the panel mounts then, so its counters count up as the dots land.
 */

/**
 * Builds the hidden map in an idle moment of its own, apart from parsing the ward data; at once
 * when the ward is wanted on screen. Once built it stays, for the next "See your ward".
 */
function useIdleArmed(wanted: boolean, now: boolean): boolean {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!wanted || armed) return
    const arm = () => setArmed(true)
    if (!('requestIdleCallback' in window)) {
      const timer = setTimeout(arm, 0)
      return () => clearTimeout(timer)
    }
    const handle = window.requestIdleCallback(arm, { timeout: 3000 })
    return () => window.cancelIdleCallback(handle)
  }, [wanted, armed])
  return armed || now
}

/** The drafting sheet behind Yuvi's ward panel, where wardMap.css puts the panel (wardStage.css). */
function WardSheet() {
  return (
    <div className="ward-sheet">
      <Blueprint logo={false} edge />
    </div>
  )
}

/**
 * Sets the ward panel's scrollbar width on the map as --scrollbar, so wardStage.css can run the
 * scrollbar down the sheet's band, as ResultPanel.tsx does for the result panel.
 */
function useScrollbarWidth() {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const map = ref.current
    const panel = map?.querySelector<HTMLElement>('.ward-panel')
    if (map && panel) map.style.setProperty('--scrollbar', `${panel.offsetWidth - panel.clientWidth}px`)
  })
  return ref
}

export function WardStage() {
  const view = useApp((s) => s.view)
  const wardId = useApp((s) => s.wardId)
  const wardData = useApp((s) => s.wardData)
  const wardStatus = useApp((s) => s.wardStatus)
  const check = useApp((s) => s.check)
  const lang = useApp((s) => s.lang)
  const hasLot = useApp((s) => s.checkKey !== null)
  const openLot = useApp((s) => s.openLot)
  const backToLot = useApp((s) => s.backToLot)
  const [filter, setFilter] = useState<DesignFilter>('all')
  const data = wardData?.ward.ward_id === wardId ? wardData : null
  // Yuvi's near-your-lot circle and box, only for a check in this ward.
  const { nearRing, near } = useNearYourLot(check?.lot.ward_id === wardId ? check : null, data)
  const active = view !== 'landing' && view !== 'flying'
  const armed = useIdleArmed(active && data !== null, view === 'toWard' || view === 'ward')
  const mapRef = useScrollbarWidth()

  if (!wardId || !active) return null
  const shown = view === 'ward'
  const style = { '--ward-panel-width': `${PANEL_WIDTH_PX}px` } as CSSProperties

  if (!data || !armed) {
    if (!shown) return null
    return (
      <div className="ward-stage ward-stage-shown">
        <div ref={mapRef} className="ward-map" style={style}>
          <WardSheet />
          <aside className="ward-panel" aria-busy={wardStatus !== 'error'}>
            {wardStatus === 'error' ? (
              <p role="alert">{labels.ui.load_error}</p>
            ) : (
              <>
                <p className="sr-only">{wardCopy.loading}</p>
                <div className="ward-skeleton ward-skeleton-title" />
                <div className="ward-skeleton ward-skeleton-line" />
                <div className="ward-skeleton ward-skeleton-block" />
              </>
            )}
          </aside>
        </div>
      </div>
    )
  }

  // A ward without the sixplex overlay cannot keep a sixplex selected.
  const design: DesignFilter = isDisabled(filter, data.ward.sixplex_overlay) ? 'all' : filter
  // The searched lot pulses only while the map shows: a hidden pulse would redraw the map every frame.
  const searched = shown && check?.lot.ward_id === wardId ? check.lot.lot_id : null
  // The same map label as Yuvi's WardMap.tsx, so a screen reader hears about the circle too.
  const mapLabel = nearRing && near ? `${wardCopy.map_aria} ${fill(wardCopy.near_ring_label, { radius_m: formatNumber(near.radiusM, true) })}.` : wardCopy.map_aria

  return (
    <div className={shown ? 'ward-stage ward-stage-shown' : 'ward-stage'} aria-hidden={!shown}>
      <div ref={mapRef} className="ward-map" style={style}>
        <WardMapCanvas data={data} filter={design} searchedLotId={searched} onSelectLot={(lotId) => openLot(lotId)} ariaLabel={mapLabel} nearRing={nearRing} />
        <DesignFilterControl value={design} onChange={setFilter} overlay={data.ward.sixplex_overlay} />
        <Legend />
        {shown && <WardSheet />}
        {shown && <WardPanel ward={data.ward} lang={lang} trend={data.trend} near={near} onBack={hasLot ? backToLot : undefined} />}
        {shown && <NumberMarks mapRef={mapRef} />}
      </div>
    </div>
  )
}
