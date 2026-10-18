import type { WardResponse } from '@contracts/types'
import { labels } from '../../copy'
import { wardCopy } from '../WardMap/copy'
import { FILTERS, isDisabled, type DesignFilter } from '../WardMap/designs'
import { GLYPH, GLYPHS } from './designGlyph'

/**
 * The ward map's design filter (MASTERSPEC 6.5) in place of Yuvi's radio list
 * (WardMap/DesignFilterControl.tsx), with the same behaviour: a short list where each row is a radio
 * button, hidden but still there for the keyboard and screen readers, showing the design's outline at
 * its real size (designGlyph.ts) beside its name. Sixplexes where the ward has no overlay are faded and
 * say why.
 */
export function DesignPicker({ value, onChange, overlay }: { value: DesignFilter; onChange: (filter: DesignFilter) => void; overlay: WardResponse['sixplex_overlay'] }) {
  return (
    <fieldset className="ward-filter design-picker">
      <legend>{wardCopy.filter_legend}</legend>
      {FILTERS.map((filter) => {
        const disabled = isDisabled(filter, overlay)
        return (
          <label key={filter} className="design-option" data-disabled={disabled || undefined}>
            <input type="radio" name="ward-design" value={filter} checked={value === filter} disabled={disabled} onChange={() => onChange(filter)} />
            <svg className="design-glyph" width={GLYPH.width} height={GLYPH.height} aria-hidden="true">
              <path d={GLYPHS[filter]} />
            </svg>
            <span>
              {filter === 'all' ? labels.ui.all_designs : labels.designs[filter]}
              {disabled && <span className="design-option-note"> · {labels.ui.not_allowed_in_this_ward}</span>}
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
