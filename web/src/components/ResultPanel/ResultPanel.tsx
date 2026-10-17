import { labels, pending } from '../../copy'
import { useApp } from '../../state/store'
import { DesignTabs } from './DesignTabs'
import { Header } from './Header'
import { PANEL_ID, tabId } from './tabs'

/** The address check panel (MASTERSPEC 6.4). J4 fills the tab panel: checklist, flags, permits, explanation. */
export function ResultPanel() {
  const check = useApp((s) => s.check)
  const status = useApp((s) => s.checkStatus)
  const error = useApp((s) => s.checkError)
  const designId = useApp((s) => s.designId)
  const setDesign = useApp((s) => s.setDesign)

  if (status === 'error') {
    const message =
      error === 'address_not_found'
        ? labels.ui.address_not_found
        : error === 'outside_toronto'
          ? labels.ui.outside_toronto
          : pending.load_error
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

  return (
    <aside className="panel">
      <Header check={check} />
      <DesignTabs designs={check.designs} selected={designId} onSelect={setDesign} />
      <div
        id={PANEL_ID}
        role="tabpanel"
        aria-labelledby={designId ? tabId(designId) : undefined}
        className="design-tabpanel"
      />
    </aside>
  )
}
