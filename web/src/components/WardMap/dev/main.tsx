import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'maplibre-gl/dist/maplibre-gl.css'
import '@contracts/design-tokens.css'
import '../../../styles/typography.css'
import type { CheckResponse } from '@contracts/types'
import wardFixture from '@contracts/fixtures/ward.04.json'
import checkFits from '@contracts/fixtures/check.fits.json'
import checkBorderline from '@contracts/fixtures/check.borderline.json'
import checkNoFit from '@contracts/fixtures/check.no_fit.json'
import checkNotChecked from '@contracts/fixtures/check.not_checked.json'
import { WardMap } from '../index'

// Dev harness, not part of the app build: http://localhost:5173/src/components/WardMap/dev/index.html
// Optional ?ward=04&lot=<lot id>&overlay=none&check=borderline (fits, borderline, no_fit or not_checked: passes that
// fixture as `check`, so "Near your lot" shows; with no ?check there is no box and no circle). It runs the ward map on its own, the way Jayden's App.tsx will.
const params = new URLSearchParams(window.location.search)

// ?overlay=none|partial|full forces the sixplex overlay state of the fixture ward, to see the filter's states.
const overlay = params.get('overlay')
if (overlay) (wardFixture as { sixplex_overlay: string }).sixplex_overlay = overlay

const checks: Record<string, unknown> = { fits: checkFits, borderline: checkBorderline, no_fit: checkNoFit, not_checked: checkNotChecked }
const checkName = params.get('check')
const check = checkName && checkName in checks ? (checks[checkName] as CheckResponse) : null

document.body.style.margin = '0'
document.body.style.height = '100vh'
const root = document.getElementById('root')!
root.style.height = '100%'

createRoot(root).render(
  <StrictMode>
    <WardMap
      wardId={params.get('ward') ?? '04'}
      searchedLotId={params.get('lot')}
      check={check}
      onSelectLot={(lotId) => console.info('select lot', lotId)}
      onBack={() => console.info('back to your lot')}
    />
  </StrictMode>,
)
