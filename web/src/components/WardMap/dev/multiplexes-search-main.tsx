import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'maplibre-gl/dist/maplibre-gl.css'
import '@contracts/design-tokens.css'
import '../../../styles/typography.css'
import { MultiplexBrowser } from '../index'

// Dev harness, not part of the app build: http://localhost:5173/src/components/WardMap/dev/multiplexes-search.html
// The "search for permitted multiplexes" page on its own, the way the app will mount it.
// A search can be shared: ?q=dundas&units=3,4&status=cleared&sort=units&near=-79.4515,43.6459

document.body.style.margin = '0'
document.body.style.height = '100vh'
const root = document.getElementById('root')!
root.style.height = '100%'

createRoot(root).render(
  <StrictMode>
    <MultiplexBrowser />
  </StrictMode>,
)
