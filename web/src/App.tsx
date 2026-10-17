import type { CSSProperties } from 'react'
import { BaseMap } from './components/BaseMap/BaseMap'
import { Landing } from './components/Landing/Landing'
import { Scene } from './components/Lot3D/Scene'
import { ResultPanel } from './components/ResultPanel/ResultPanel'
import { Search } from './components/Search/Search'
import { PANEL_WIDTH_PX } from './layout'
import { useApp } from './state/store'
import { useUrlSync } from './state/useUrlSync'

export default function App() {
  useUrlSync()
  const view = useApp((s) => s.view)
  return (
    <main className="app" style={{ '--panel-width': `${PANEL_WIDTH_PX}px` } as CSSProperties}>
      <BaseMap />
      {(view === 'landing' || view === 'flying') && <Landing leaving={view === 'flying'} />}
      {view === 'lot' && <LotView />}
    </main>
  )
}

/** The address check (MASTERSPEC 6.2): the 3D scene full-bleed, the result panel on the right. */
function LotView() {
  const check = useApp((s) => s.check)
  const designId = useApp((s) => s.designId)
  const showLanding = useApp((s) => s.showLanding)
  return (
    <>
      {check && <Scene check={check} designId={designId} rightInsetPx={PANEL_WIDTH_PX} />}
      <div className="topbar">
        <button type="button" className="brand" onClick={() => showLanding()}>
          Suplex
        </button>
        <Search variant="compact" />
      </div>
      <ResultPanel />
    </>
  )
}
