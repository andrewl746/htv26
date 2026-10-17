import { useRef, type KeyboardEvent } from 'react'
import type { DesignId, DesignResult } from '@contracts/types'
import { labels } from '../../copy'
import { inDesignOrder } from '../../designs'
import { ResultIcon } from './ResultIcon'
import { PANEL_ID, tabId } from './tabs'

/** One tab per design with an icon and the result in words (MASTERSPEC 6.4); arrows move between them. */
export function DesignTabs({
  designs,
  selected,
  onSelect,
}: {
  designs: DesignResult[]
  selected: DesignId | null
  onSelect: (id: DesignId) => void
}) {
  const ordered = inDesignOrder(designs)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  function onKeyDown(event: KeyboardEvent, index: number) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
    if (!step) return
    event.preventDefault()
    const next = (index + step + ordered.length) % ordered.length
    onSelect(ordered[next].design_id)
    buttons.current[next]?.focus()
  }

  return (
    <div role="tablist" className="design-tabs">
      {ordered.map((d, i) => {
        const isSelected = d.design_id === selected
        return (
          <button
            key={d.design_id}
            ref={(el) => {
              buttons.current[i] = el
            }}
            id={tabId(d.design_id)}
            type="button"
            role="tab"
            aria-selected={isSelected}
            aria-controls={PANEL_ID}
            tabIndex={isSelected ? 0 : -1}
            className="design-tab"
            onClick={() => onSelect(d.design_id)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            <ResultIcon result={d.result} />
            <span className="design-tab-text">
              <span className="design-tab-name">{labels.designs[d.design_id]}</span>
              <span className="design-tab-result">{labels.results[d.result]}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
