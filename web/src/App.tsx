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
  const check = useApp((s) => s.check)
  const designId = useApp((s) => s.designId)
  const inLot = view === 'lot'
  return (
    <main className="app" style={{ '--panel-width': `${PANEL_WIDTH_PX}px` } as CSSProperties}>
      <BaseMap />
      {/* Always mounted so its shaders are ready before the first address (see Scene). */}
      <Scene
        check={inLot ? check : null}
        designId={designId}
        visible={inLot && check !== null}
        rightInsetPx={PANEL_WIDTH_PX}
      />
      {(view === 'landing' || view === 'flying') && <Landing leaving={view === 'flying'} />}
      {inLot && <LotChrome />}
    </main>
  )
}

/** The address check's search bar and result panel (MASTERSPEC 6.2), over the 3D scene. */
function LotChrome() {
  const showLanding = useApp((s) => s.showLanding)
  return (
    <>
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
