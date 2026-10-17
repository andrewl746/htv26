import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

// MapLibre looks for its worker next to its own file, which Vite moves; hand it the worker as Vite
// builds workers (see BaseMap.tsx). Setting it again with the same URL is harmless, and doing it
// here means the ward map also works where BaseMap is not loaded.
setWorkerUrl(workerUrl)
