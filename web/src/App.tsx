import type { CSSProperties } from 'react'
import { BaseMap } from './components/BaseMap/BaseMap'
import { Landing } from './components/Landing/Landing'
import { Scene } from './components/Lot3D/Scene'
import { PlanTab } from './components/Plan/PlanTab'
import { ResultPanel } from './components/ResultPanel/ResultPanel'
import { Search } from './components/Search/Search'
import { WardMap } from './components/WardMap'
import { labels } from './copy'
import { PANEL_WIDTH_PX } from './layout'
import { useApp } from './state/store'
import { useUrlSync } from './state/useUrlSync'

export default function App() {
  useUrlSync()
  const view = useApp((s) => s.view)
  const handoff = useApp((s) => s.handoff)
  const check = useApp((s) => s.check)
  const designId = useApp((s) => s.designId)
  const inLot = view === 'lot'
  // The street is built as the check comes back (before the flight starts) and shown from the
  // handoff, over the flight's last stretch.
  // The plan and ward views keep the street built behind them, so the way back to the 3D lot is instant.
  const sceneCheck = view === 'landing' ? null : check
  return (
    <main className="app" style={{ '--panel-width': `${PANEL_WIDTH_PX}px` } as CSSProperties}>
      <BaseMap />
      {/* Always mounted so its shaders are ready before the first address (see Scene). */}
      <Scene
        check={sceneCheck}
        designId={designId}
        visible={(inLot || handoff) && sceneCheck !== null}
        rightInsetPx={PANEL_WIDTH_PX}
      />
      {(view === 'landing' || view === 'flying') && <Landing leaving={view === 'flying'} />}
      {inLot && <LotChrome />}
      {view === 'plan' && <PlanTab />}
      {view === 'ward' && <WardView />}
    </main>
  )
}

/** The address check's search bar and result panel (MASTERSPEC 6.2), over the 3D scene. */
function LotChrome() {
  const showLanding = useApp((s) => s.showLanding)
  const showPlan = useApp((s) => s.showPlan)
  return (
    <>
      <div className="topbar">
        <button type="button" className="brand" onClick={() => showLanding()}>
          Suplex
        </button>
        <Search variant="compact" />
        <button type="button" className="plan-switch" onClick={() => showPlan()}>
          {labels.ui.view_2d}
        </button>
      </div>
      <ResultPanel />
    </>
  )
}

/** The ward map (MASTERSPEC 6.5) for the checked lot's ward, or a ward named in the URL. */
function WardView() {
  const wardId = useApp((s) => s.wardId)
  const check = useApp((s) => s.check)
  const lang = useApp((s) => s.lang)
  const hasLot = useApp((s) => s.checkKey !== null)
  const openLot = useApp((s) => s.openLot)
  const showLot = useApp((s) => s.showLot)
  if (!wardId) return null
  return (
    <div className="ward-view">
      <WardMap
        wardId={wardId}
        searchedLotId={check?.lot.ward_id === wardId ? check.lot.lot_id : null}
        onSelectLot={(lotId) => openLot(lotId)}
        lang={lang}
        onBack={hasLot ? () => showLot() : undefined}
      />
    </div>
  )
}
