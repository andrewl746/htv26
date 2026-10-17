import type { WardResponse } from '@contracts/types'
import { labels } from '../../copy'
import { wardCopy } from './copy'
import { FILTERS, isDisabled, type DesignFilter } from './designs'

/** The five-option design filter (MASTERSPEC 6.5). Partial wards keep the sixplexes on. */
export function DesignFilterControl({
  value,
  onChange,
  overlay,
}: {
  value: DesignFilter
  onChange: (filter: DesignFilter) => void
  overlay: WardResponse['sixplex_overlay']
}) {
  return (
    <fieldset className="ward-filter">
      <legend>{wardCopy.filter_legend}</legend>
      {FILTERS.map((filter) => {
        const disabled = isDisabled(filter, overlay)
        const name = filter === 'all' ? labels.ui.all_designs : labels.designs[filter]
        return (
          <label key={filter} className="ward-filter-option" data-disabled={disabled || undefined}>
            <input type="radio" name="ward-design" value={filter} checked={value === filter} disabled={disabled} onChange={() => onChange(filter)} />
            <span>
              {name}
              {disabled && <span className="ward-filter-note"> · {labels.ui.not_allowed_in_this_ward}</span>}
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
