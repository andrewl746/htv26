import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'maplibre-gl/dist/maplibre-gl.css'
import '@contracts/design-tokens.css'
import '../../../styles/palette.css'
import '../../../styles/typography.css'
import { MultiplexMap } from '../index'

// Dev harness, not part of the app build: http://localhost:5173/src/components/WardMap/dev/multiplexes.html
// It runs the permitted-multiplexes map on its own, the way the Multiplexes tab will mount it.
document.body.style.margin = '0'
document.body.style.height = '100vh'
const root = document.getElementById('root')!
root.style.height = '100%'

createRoot(root).render(
  <StrictMode>
    <MultiplexMap onSelectWard={(ward) => console.info('select ward', ward)} />
  </StrictMode>,
)
