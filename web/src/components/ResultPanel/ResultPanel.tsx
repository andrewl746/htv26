import type { ReactNode } from 'react'
import { disclaimers, labels } from '../../copy'
import { useApp } from '../../state/store'
import { Checklist } from './Checklist'
import { DesignTabs } from './DesignTabs'
import { Explanation } from './Explanation'
import { Flags } from './Flags'
import { Header } from './Header'
import { NextSteps } from './NextSteps'
import { NotChecked } from './NotChecked'
import { NotSupportedBanner } from './NotSupportedBanner'
import { PermitsNearby } from './PermitsNearby'
import { PANEL_ID, tabId } from './tabs'

/**
 * The address check panel (MASTERSPEC 6.4). The tab panel holds what changes with the design (the
 * checklist and the explanation of the same numbers); the lot's flags, the permits near it, what
 * we don't check and the next steps follow. "See your ward" stays at the bottom while it scrolls.
 * The plan view shows the same panel with its legend in `extra`.
 */
export function ResultPanel({ extra }: { extra?: ReactNode }) {
  const check = useApp((s) => s.check)
  const status = useApp((s) => s.checkStatus)
  const error = useApp((s) => s.checkError)
  const designId = useApp((s) => s.designId)
  const setDesign = useApp((s) => s.setDesign)
  const showWard = useApp((s) => s.showWard)
  const graphics = useApp((s) => s.graphics)

  if (status === 'error') {
    const message =
      error === 'address_not_found'
        ? labels.ui.address_not_found
        : error === 'outside_toronto'
          ? labels.ui.outside_toronto
          : labels.ui.load_error
    return (
      <aside className="panel">
        <p className="panel-message" role="alert">
          {message}
        </p>
      </aside>
    )
  }

  if (status !== 'ready' || !check) {
    return (
      <aside className="panel" aria-busy="true">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-tabs" />
      </aside>
    )
  }

  const design = check.designs.find((d) => d.design_id === designId) ?? null
  // No design could be checked on this lot: say so up top instead of four "Not checked" tabs.
  const unsupported = check.lot.reason !== null && check.designs.every((d) => d.result === 'not_checked')

  return (
    <aside className="panel">
      <Header check={check} hideReason={unsupported} />
      {unsupported && check.lot.reason ? (
        <NotSupportedBanner reason={check.lot.reason} />
      ) : (
        <>
          <DesignTabs designs={check.designs} selected={designId} onSelect={setDesign} />
          <div
            id={PANEL_ID}
            role="tabpanel"
            aria-labelledby={designId ? tabId(designId) : undefined}
            className="design-tabpanel"
          >
            {design && <Checklist design={design} />}
            {designId && <Explanation check={check} designId={designId} />}
          </div>
        </>
      )}
      {extra}
      <Flags flags={check.lot.flags} />
      <PermitsNearby permits={check.permits_nearby} />
      <NotChecked items={check.not_checked} />
      <p className="disclaimer panel-section">{disclaimers.massing}</p>
      <NextSteps steps={check.next_steps} />
      {/* The ward map needs WebGL. */}
      {graphics && (
        <div className="panel-footer">
          <button type="button" className="button-primary" onClick={() => showWard()}>
            {labels.ui.see_your_ward}
          </button>
        </div>
      )}
    </aside>
  )
}
