import type { Map as MapLibreMap } from 'maplibre-gl'
import { tokenHex } from '../../styles/tokens'

// OpenFreeMap's positron style (MASTERSPEC 6.1) recoloured to the UI palette, with the buildings
// stood up in 3D from the tiles' own heights. Layer ids are positron's.

const BUILDING_FALLBACK_HEIGHT_M = 4

type PaintProperty = Parameters<MapLibreMap['setPaintProperty']>[1]

export function applyPalette(map: MapLibreMap): void {
  const charcoal = tokenHex('--palette-charcoal')
  const grey = tokenHex('--palette-grey')
  const olive = tokenHex('--palette-olive')
  const tea = tokenHex('--palette-tea')
  const land = tokenHex('--suplex-surface')

  const paint: [layer: string, property: PaintProperty, value: string][] = [
    ['background', 'background-color', land],
    ['landuse_residential', 'fill-color', land],
    ['park', 'fill-color', tea],
    ['landcover_wood', 'fill-color', tea],
    ['water', 'fill-color', grey],
    ['waterway', 'line-color', grey],
  ]
  for (const [layer, property, value] of paint) {
    if (map.getLayer(layer)) map.setPaintProperty(layer, property, value)
  }

  if (map.getLayer('building')) map.setLayoutProperty('building', 'visibility', 'none')
  const firstLabel = map.getStyle().layers.find((l) => l.type === 'symbol')?.id
  map.addLayer(
    {
      id: 'building-3d',
      type: 'fill-extrusion',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 12,
      filter: [
        'all',
        // A building drawn as parts also comes as an outline marked hide_3d; drawing both stacks
        // coplanar faces that flicker as the camera moves.
        ['!=', ['get', 'hide_3d'], true],
        // Tiles below zoom 14 merge neighbouring buildings into whole blocks, which split apart
        // into houses as the camera nears. Only zoom-14 tiles (and closer) draw buildings; a parent
        // tile standing in while its children load shows ground rather than a block.
        ['>=', ['zoom'], 14],
      ],
      paint: {
        // Taller buildings darken from olive through grey to charcoal, so the skyline reads.
        'fill-extrusion-color': [
          'interpolate',
          ['linear'],
          ['coalesce', ['get', 'render_height'], 0],
          0,
          olive,
          80,
          grey,
          250,
          charcoal,
        ],
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], BUILDING_FALLBACK_HEIGHT_M],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        // Opaque: see-through extrusions show the walls behind them and shimmer in motion.
        'fill-extrusion-opacity': 1,
      },
    },
    firstLabel,
  )
}
