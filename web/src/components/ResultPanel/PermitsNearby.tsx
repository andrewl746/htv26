import type { PermitsNearby as PermitsNearbyData } from '@contracts/types'
import { disclaimers, fill, labels } from '../../copy'

/**
 * "N multiplex permits within 500 m since May 2023" (MASTERSPEC 6.4). The dots themselves are in
 * the 3D scene, unlabelled; never an address.
 */
export function PermitsNearby({ permits }: { permits: PermitsNearbyData }) {
  const line = permits.count === 1 ? labels.ui.permits_near_you_line_one : labels.ui.permits_near_you_line
  return (
    <section className="panel-section" aria-labelledby="permits-title">
      <h3 id="permits-title" className="section-title">
        {labels.ui.permits_near_you}
      </h3>
      <p className="permits-line">
        <span className="permit-dot" aria-hidden="true" />
        {fill(line, { count: permits.count, radius_m: permits.radius_m })}
      </p>
      <p className="panel-muted">{disclaimers.permits_label}</p>
    </section>
  )
}
