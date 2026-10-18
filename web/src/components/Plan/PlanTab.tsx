import { useState } from 'react'
import { labels } from '../../copy'
import { useApp } from '../../state/store'
import { ResultPanel } from '../ResultPanel/ResultPanel'
import { Search } from '../Search/Search'
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
  const designId = useApp((s) => s.designId)
  const graphics = useApp((s) => s.graphics)
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
        <button type="button" className="brand" aria-label="Suplex" onClick={() => showLanding()}>
          <span className="brand-mark" />
        </button>
        <Search variant="compact" />
        {/* Without WebGL the plan view is the address check. */}
        {graphics && (
          <button type="button" className="plan-switch" onClick={() => showLot()}>
            {labels.ui.view_3d}
          </button>
        )}
      </div>

      {ready && (
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
        </>
      )}
      {/* The same panel as the 3D view (MASTERSPEC 6.7), with the plan's legend. */}
      <ResultPanel
        extra={
          <section className="panel-section">
            <Legend />
            <p className="disclaimer">{planCopy.permits_unlabelled}</p>
          </section>
        }
      />
    </div>
  )
}
