import type { CheckResponse } from '@contracts/types'
import { disclaimers, formatNumber, labels } from '../../copy'

/** The address, the ward, the lot's size on one line, and the disclaimer (MASTERSPEC 6.4). */
/** `hideReason` leaves out the lot's reason when the not-supported banner already shows it. */
export function Header({ check, hideReason = false }: { check: CheckResponse; hideReason?: boolean }) {
  const { address, lot } = check
  const m = labels.units.m
  const area = `${formatNumber(lot.area_m2, true)} ${labels.units.m2}`
  const size =
    lot.width_m !== null && lot.depth_m !== null
      ? `${formatNumber(lot.width_m)} ${m} × ${formatNumber(lot.depth_m)} ${m} · ${area}`
      : area

  return (
    <header className="panel-header">
      <h2 className="panel-address">{address.address_full ?? lot.ward_name}</h2>
      <p className="panel-ward">{lot.ward_name}</p>
      <p className="panel-size">{size}</p>
      {check.meta.cached && <span className="badge badge-cached">{disclaimers.cached}</span>}
      {lot.reason && !hideReason && (
        <p className="panel-reason">
          <strong>{lot.reason.label}.</strong> {lot.reason.text}
        </p>
      )}
      <p className="disclaimer">{disclaimers.screening}</p>
    </header>
  )
}
