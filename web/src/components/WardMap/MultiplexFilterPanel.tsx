import { memo, useId, useState } from 'react'
import { fill, formatNumber } from '../../copy'
import { MxMarker } from './MxMarker'
import { mxCopy } from './multiplex/copy'
import { isDefaultFilters, toggle } from './multiplex/filters'
import { DEFAULT_FILTERS, UNIT_OPTIONS, type MultiplexFilters, type MxStatus, type MxWork } from './multiplex/types'

const STATUS_OPTIONS: readonly MxStatus[] = ['cleared', 'active']
const WORK_OPTIONS: readonly MxWork[] = ['new_build', 'conversion']
/** At or below this width the panel starts collapsed (keep in step with multiplex.css). */
const NARROW_QUERY = '(max-width: 640px)'

interface Props {
  filters: MultiplexFilters
  onChange: (filters: MultiplexFilters) => void
  shown: number
  total: number
  showPermits: boolean
  onShowPermits: (show: boolean) => void
}

/**
 * Floating filter panel: real checkboxes grouped in fieldsets, a live count line and a reset.
 * On narrow screens a button collapses it; on wide screens it is always open.
 */
export const MultiplexFilterPanel = memo(function MultiplexFilterPanel({ filters, onChange, shown, total, showPermits, onShowPermits }: Props) {
  const bodyId = useId()
  const [open, setOpen] = useState(() => !window.matchMedia(NARROW_QUERY).matches)

  return (
    <aside className="mx-panel" data-open={open} aria-label={mxCopy.aria.filters}>
      <button type="button" className="mx-panel-toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(!open)}>
        {mxCopy.filters.title}
      </button>
      <div className="mx-panel-body" id={bodyId}>
        <h2 className="mx-panel-title">{mxCopy.title}</h2>
        <label className="mx-check mx-layer-toggle">
          <input type="checkbox" checked={showPermits} onChange={(e) => onShowPermits(e.target.checked)} />
          <span>{mxCopy.layer_toggle}</span>
        </label>

        <fieldset className="mx-group">
          <legend>{mxCopy.filters.units.title}</legend>
          <div className="mx-group-row">
            {UNIT_OPTIONS.map((units) => (
              <label key={units} className="mx-check">
                <input type="checkbox" checked={filters.units.includes(units)} onChange={() => onChange({ ...filters, units: toggle(filters.units, units) })} />
                <span>{mxCopy.filters.units.options[units]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mx-group">
          <legend>{mxCopy.filters.status.title}</legend>
          {STATUS_OPTIONS.map((status) => (
            <label key={status} className="mx-check">
              <input type="checkbox" checked={filters.status.includes(status)} onChange={() => onChange({ ...filters, status: toggle(filters.status, status) })} />
              <MxMarker kind={status} />
              <span>{mxCopy.filters.status.options[status]}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className="mx-group">
          <legend>{mxCopy.filters.work.title}</legend>
          {WORK_OPTIONS.map((work) => (
            <label key={work} className="mx-check">
              <input type="checkbox" checked={filters.work.includes(work)} onChange={() => onChange({ ...filters, work: toggle(filters.work, work) })} />
              <span>{mxCopy.filters.work.options[work]}</span>
            </label>
          ))}
        </fieldset>

        <p className="mx-count" role="status" aria-live="polite">
          {shown === 0 ? mxCopy.empty : fill(mxCopy.shown, { shown: formatNumber(shown, true), total: formatNumber(total, true) })}
        </p>
        <button
          type="button"
          className="mx-reset"
          disabled={isDefaultFilters(filters)}
          onClick={() => onChange({ units: [...DEFAULT_FILTERS.units], status: [...DEFAULT_FILTERS.status], work: [...DEFAULT_FILTERS.work] })}
        >
          {mxCopy.filters.reset}
        </button>
      </div>
    </aside>
  )
})
