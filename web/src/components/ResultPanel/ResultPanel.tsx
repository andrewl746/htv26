import { Fragment, useLayoutEffect, useRef, type ReactNode } from 'react'
import { disclaimers, labels } from '../../copy'
import { useApp } from '../../state/store'
import { Blueprint } from '../Landing/Blueprint'
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
 * we don't check and the next steps follow, each section set off by a teal rule. "See your ward"
 * stays at the bottom while it scrolls. The plan view shows the same panel with its legend in `extra`.
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
      <Sheet>
        <p className="panel-message" role="alert">
          {message}
        </p>
      </Sheet>
    )
  }

  if (status !== 'ready' || !check) {
    return (
      <Sheet busy>
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-tabs" />
      </Sheet>
    )
  }

  const design = check.designs.find((d) => d.design_id === designId) ?? null
  // No design could be checked on this lot: say so up top instead of four "Not checked" tabs.
  const unsupported = check.lot.reason !== null && check.designs.every((d) => d.result === 'not_checked')
  // The checklist draws nothing for a design without rules (see Checklist).
  const hasChecklist = design !== null && design.rules.length > 0

  // The panel's sections in order, with a rule between each two that show. Flags and next steps
  // draw nothing when their lists are empty, so they are left out here too, and no rule is ever
  // left with nothing after it. Named, so one coming or going never remounts the rest.
  const sections: { key: string; node: ReactNode }[] = [
    { key: 'header', node: <Header check={check} hideReason={unsupported} /> },
    {
      key: 'result',
      node:
        unsupported && check.lot.reason ? (
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
              {/* The explanation is a section of its own, still inside the tab panel. */}
              {hasChecklist && designId && <hr className="section-rule" />}
              {designId && <Explanation check={check} designId={designId} />}
            </div>
          </>
        ),
    },
    { key: 'extra', node: extra },
    { key: 'flags', node: check.lot.flags.length > 0 && <Flags flags={check.lot.flags} /> },
    { key: 'permits', node: <PermitsNearby permits={check.permits_nearby} /> },
    {
      key: 'limits',
      node: (
        <>
          <NotChecked items={check.not_checked} />
          <p className="disclaimer panel-section">{disclaimers.massing}</p>
        </>
      ),
    },
    { key: 'next', node: check.next_steps.length > 0 && <NextSteps steps={check.next_steps} /> },
  ]

  return (
    <Sheet
      footer={
        <div className="panel-footer">
          {/* The ward map needs WebGL. */}
          {graphics && (
            <button type="button" className="button-primary" onClick={() => showWard()}>
              {labels.ui.see_your_ward}
            </button>
          )}
          {/* On every result, and always on screen. */}
          <p className="disclaimer">{disclaimers.screening}</p>
        </div>
      }
    >
      {sections
        .filter((s) => s.node)
        .map((s, i) => (
          <Fragment key={s.key}>
            {i > 0 && <hr className="section-rule" />}
            {s.node}
          </Fragment>
        ))}
    </Sheet>
  )
}

/** The panel on the landing card's drafting sheet (Landing/Blueprint.tsx), whose outer rule is the
 *  panel's edge: the content scrolls inside the ruled area, and `footer` stays under it. */
function Sheet({ children, footer, busy = false }: { children: ReactNode; footer?: ReactNode; busy?: boolean }) {
  const body = useRef<HTMLDivElement>(null)
  // The scrollbar runs down the band beside the ruled area, so app.css takes its width (0 where
  // scrollbars float over the page) out of the band's padding instead of the content.
  useLayoutEffect(() => {
    const el = body.current
    if (el) el.style.setProperty('--scrollbar', `${el.offsetWidth - el.clientWidth}px`)
  }, [])
  return (
    <aside className="panel" aria-busy={busy || undefined}>
      <Blueprint logo={false} edge />
      <div ref={body} className="panel-body">
        {children}
      </div>
      {footer}
    </aside>
  )
}
