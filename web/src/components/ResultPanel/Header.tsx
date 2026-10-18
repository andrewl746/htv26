import type { CheckResponse } from '@contracts/types'
import { disclaimers, formatNumber, labels } from '../../copy'

/** One side of the lot as a drafting dimension: tick-ended lines either side of its length (app.css
 *  .dimension). The lines share the row's spare room by the metres, so the deeper side draws longer. */
function Dimension({ metres, title }: { metres: number; title: string }) {
  return (
    <span className="dimension" title={title} style={{ flexGrow: metres }}>
      {formatNumber(metres)} {labels.units.m}
    </span>
  )
}

/** The address under its ward and the lot's size drawn as dimensions (MASTERSPEC 6.4). The disclaimer
 *  line sits in the panel's footer instead (ResultPanel.tsx), where it never scrolls away. */
/** `hideReason` leaves out the lot's reason when the not-supported banner already shows it. */
export function Header({ check, hideReason = false }: { check: CheckResponse; hideReason?: boolean }) {
  const { address, lot } = check

  return (
    <header className="panel-header">
      <h2 className="panel-address">{address.address_full ?? lot.ward_name}</h2>
      {/* Shown above the address (app.css), and read after it. */}
      <p className="panel-ward">{lot.ward_name}</p>
      <p className="panel-size">
        {lot.width_m !== null && lot.depth_m !== null && (
          <>
            <Dimension metres={lot.width_m} title={labels.rules.lot_width} />
            <span className="panel-size-times">×</span>
            <Dimension metres={lot.depth_m} title={labels.rules.lot_depth} />
          </>
        )}
        <span className="panel-size-area">
          {formatNumber(lot.area_m2, true)} {labels.units.m2}
        </span>
      </p>
      {check.meta.cached && <span className="badge badge-cached">{disclaimers.cached}</span>}
      {lot.reason && !hideReason && (
        <p className="panel-reason">
          <strong>{lot.reason.label}.</strong> {lot.reason.text}
        </p>
      )}
    </header>
  )
}
