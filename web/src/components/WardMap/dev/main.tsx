import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'maplibre-gl/dist/maplibre-gl.css'
import '@contracts/design-tokens.css'
import '../../../styles/palette.css'
import '../../../styles/typography.css'
import wardFixture from '@contracts/fixtures/ward.04.json'
import { WardMap } from '../index'

// Dev harness, not part of the app build: http://localhost:5173/src/components/WardMap/dev/index.html
// Optional ?ward=04&lot=<lot id>&overlay=none. It runs the ward map on its own, the way Jayden's App.tsx will.
const params = new URLSearchParams(window.location.search)

// ?overlay=none|partial|full forces the sixplex overlay state of the fixture ward, to see the filter's states.
const overlay = params.get('overlay')
if (overlay) (wardFixture as { sixplex_overlay: string }).sixplex_overlay = overlay

document.body.style.margin = '0'
document.body.style.height = '100vh'
const root = document.getElementById('root')!
root.style.height = '100%'

createRoot(root).render(
  <StrictMode>
    <WardMap
      wardId={params.get('ward') ?? '04'}
      searchedLotId={params.get('lot')}
      onSelectLot={(lotId) => console.info('select lot', lotId)}
      onBack={() => console.info('back to your lot')}
    />
  </StrictMode>,
)
