import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'maplibre-gl/dist/maplibre-gl.css'
import '@contracts/design-tokens.css'
import '../../../styles/palette.css'
import '../../../styles/typography.css'
import { MultiplexMap } from '../index'

// Dev harness, not part of the app build: http://localhost:5173/src/components/WardMap/dev/multiplexes.html
// It runs the permitted-multiplexes map on its own, the way the Multiplexes tab will mount it.
// Add ?near=-79.4515,43.6459 (lon,lat) to open the near-me view without typing.

/** `?near=lon,lat` inside the Toronto box, or undefined. */
function nearFromUrl(): { lon: number; lat: number } | undefined {
  const raw = new URLSearchParams(window.location.search).get('near')
  if (!raw) return undefined
  const [lon, lat] = raw.split(',').map(Number)
  const ok = Number.isFinite(lon) && Number.isFinite(lat) && lon >= -79.65 && lon <= -79.1 && lat >= 43.55 && lat <= 43.86
  return ok ? { lon, lat } : undefined
}

document.body.style.margin = '0'
document.body.style.height = '100vh'
const root = document.getElementById('root')!
root.style.height = '100%'

createRoot(root).render(
  <StrictMode>
    <MultiplexMap onSelectWard={(ward) => console.info('select ward', ward)} initialNear={nearFromUrl()} />
  </StrictMode>,
)
