import { useState, type CSSProperties } from 'react'
import type { CheckResponse, Lang } from '@contracts/types'
import { fill, formatNumber, pending } from '../../copy'
import { PANEL_WIDTH_PX } from '../../layout'
import { wardCopy } from './copy'
import { useWardData } from './data'
import { DesignFilterControl } from './DesignFilterControl'
import { isDisabled, type DesignFilter } from './designs'
import { Legend } from './Legend'
import { useNearYourLot } from './useNearYourLot'
import { WardMapCanvas } from './WardMapCanvas'
import { WardPanel } from './WardPanel'
import './wardMap.css'

export interface WardMapProps {
  wardId: string
  /** The checked lot, outlined in white with a gentle pulse; its `lot_id` from /check. */
  searchedLotId?: string | null
  /** A lot was clicked: open its address check, as if it had been searched. */
  onSelectLot: (lotId: string) => void
  /** The language for the briefing link. */
  lang?: Lang
  /** Shows "Back to your lot" in the panel when given. */
  onBack?: () => void
  /**
   * The address check the map opened from. With it, the ward panel gets a "Near your lot" box and
   * the map a dashed circle around `context.origin`; without it neither shows.
   */
  check?: CheckResponse | null
}

/**
 * The ward map (MASTERSPEC 6.5): lots coloured by whether a free City design may fit, multiplex
 * permit dots, a design filter, a legend and the ward panel. It fills its parent. It never shows
 * an address or a parcel id, and nothing on it lists, exports or downloads lots.
 */
export function WardMap({ wardId, searchedLotId = null, onSelectLot, lang = 'en', onBack, check = null }: WardMapProps) {
  const load = useWardData(wardId)
  const [filter, setFilter] = useState<DesignFilter>('all')
  const panelStyle = { '--ward-panel-width': `${PANEL_WIDTH_PX}px` } as CSSProperties

  const loaded = load.status === 'ready' ? load.data : null
  const { nearRing, near } = useNearYourLot(check, loaded)

  if (load.status !== 'ready') {
    return (
      <div className="ward-map" style={panelStyle}>
        <aside className="ward-panel" aria-busy={load.status === 'loading'}>
          {load.status === 'error' ? (
            <p role="alert">{load.message || pending.load_error}</p>
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
    )
  }

  const { data } = load
  // A ward without the sixplex overlay cannot keep a sixplex selected.
  const active: DesignFilter = isDisabled(filter, data.ward.sixplex_overlay) ? 'all' : filter

  const mapLabel = nearRing && near ? `${wardCopy.map_aria} ${fill(wardCopy.near_ring_label, { radius_m: formatNumber(near.radiusM, true) })}.` : wardCopy.map_aria

  return (
    <div className="ward-map" style={panelStyle}>
      <WardMapCanvas data={data} filter={active} searchedLotId={searchedLotId} onSelectLot={onSelectLot} ariaLabel={mapLabel} nearRing={nearRing} />
      <DesignFilterControl value={active} onChange={setFilter} overlay={data.ward.sixplex_overlay} />
      <Legend />
      <WardPanel ward={data.ward} lang={lang} trend={data.trend} near={near} onBack={onBack} />
    </div>
  )
}
