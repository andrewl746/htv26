import { useState } from 'react'
import { disclaimers, fill, labels, pending } from '../../copy'
import { useApp } from '../../state/store'
import { DesignTabs } from '../ResultPanel/DesignTabs'
import { Header } from '../ResultPanel/Header'
import { PANEL_ID, tabId } from '../ResultPanel/tabs'
import { Legend } from './Legend'
import { PlanMap } from './PlanMap'
import { planCopy } from './copy'
import type { PlanScale, Preset } from './geometry'
import '../../styles/plan.css'

const SCALES: { id: PlanScale; label: string }[] = [
  { id: 'lot', label: planCopy.zoom_lot },
  { id: 'street', label: planCopy.zoom_street },
  { id: 'neighbourhood', label: planCopy.zoom_neighbourhood },
]

/**
 * A second view of the address check, from above: the lot plan and the multiplex permits around
 * it on one drawing. It reads the same check and the same chosen design as the 3D view.
 */
export function PlanTab() {
  const check = useApp((s) => s.check)
  const status = useApp((s) => s.checkStatus)
  const error = useApp((s) => s.checkError)
  const designId = useApp((s) => s.designId)
  const setDesign = useApp((s) => s.setDesign)
  const showLot = useApp((s) => s.showLot)
  const showLanding = useApp((s) => s.showLanding)
  // The street is where the building data is, so the plan opens there.
  const [preset, setPreset] = useState<Preset>({ scale: 'street' })
  // The wheel, a drag or a zoom button moves the view off every preset.
  const [manual, setManual] = useState(false)

  const design = check?.designs.find((d) => d.design_id === designId) ?? null
  const ready = status === 'ready' && check !== null

  return (
    <div className="plan-tab">
      <div className="topbar">
        <button type="button" className="brand" onClick={() => showLanding()}>
          Suplex
        </button>
        <button type="button" className="plan-switch" onClick={() => showLot()}>
          {labels.ui.view_3d}
        </button>
      </div>

      {ready ? (
        <>
          <PlanMap check={check} design={design} preset={preset} onManual={() => setManual(true)} />
          <div className="plan-zoom" role="group" aria-label={planCopy.zoom_group}>
            {SCALES.map((s) => (
              <button
                key={s.id}
                type="button"
                className="plan-zoom-button"
                aria-pressed={!manual && preset.scale === s.id}
                onClick={() => {
                  setPreset({ scale: s.id })
                  setManual(false)
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
          <aside className="panel">
            <Header check={check} />
            <DesignTabs designs={check.designs} selected={designId} onSelect={setDesign} />
            <div id={PANEL_ID} role="tabpanel" aria-labelledby={designId ? tabId(designId) : undefined} className="design-tabpanel plan-panel-body">
              <section>
                <h3 className="plan-heading">{labels.ui.permits_near_you}</h3>
                <p className="plan-permit-line">
                  {fill(check.permits_nearby.count === 1 ? labels.ui.permits_near_you_line_one : labels.ui.permits_near_you_line, {
                    count: check.permits_nearby.count,
                    radius_m: check.permits_nearby.radius_m,
                  })}
                </p>
                <p className="disclaimer">{disclaimers.permits_label}</p>
                <p className="disclaimer">{planCopy.permits_unlabelled}</p>
              </section>
              <Legend />
              <p className="disclaimer">
                {disclaimers.illustrative}. {disclaimers.massing}
              </p>
            </div>
          </aside>
        </>
      ) : (
        <aside className="panel" aria-busy={status !== 'error'}>
          {status === 'error' ? (
            <p className="panel-message" role="alert">
              {error === 'address_not_found'
                ? labels.ui.address_not_found
                : error === 'outside_toronto'
                  ? labels.ui.outside_toronto
                  : pending.load_error}
            </p>
          ) : (
            <>
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-tabs" />
            </>
          )}
        </aside>
      )}
    </div>
  )
}
