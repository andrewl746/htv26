import type { Map as MapLibreMap } from 'maplibre-gl'
import { neutraliseBase } from '../WardMap/layers'
import { tokenHex } from '../../styles/tokens'

// OpenFreeMap's positron style (MASTERSPEC 6.1) recoloured to the UI palette, with the buildings
// stood up in 3D from the tiles' own heights. Layer ids are positron's.

const BUILDING_FALLBACK_HEIGHT_M = 4
export const BUILDINGS_LAYER = 'building-3d'

type PaintProperty = Parameters<MapLibreMap['setPaintProperty']>[1]
type PaintValue = Parameters<MapLibreMap['setPaintProperty']>[2]

/** The palette over positron's own values, and positron's own values, for the ward transition. */
const palettes = new WeakMap<MapLibreMap, { ours: [string, PaintProperty, PaintValue][]; stock: [string, PaintProperty, PaintValue][] }>()
/** Positron's flat buildings, which the palette hides for the 3D ones and the ward map shows. */
const FLAT_BUILDINGS = 'building'

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
  const present = paint.filter(([layer]) => map.getLayer(layer))
  const stock = (layer: string, property: PaintProperty): [string, PaintProperty, PaintValue] => [
    layer,
    property,
    map.getPaintProperty(layer, property) as PaintValue,
  ]
  // Grass keeps positron's colour here, but the ward map flattens it with the parks.
  const grass = map.getLayer('landcover_grass') ? [stock('landcover_grass', 'fill-color')] : []
  palettes.set(map, {
    ours: [...present, ...grass],
    stock: [...present.map(([layer, property]) => stock(layer, property)), ...grass],
  })
  for (const [layer, property, value] of present) map.setPaintProperty(layer, property, value)

  if (map.getLayer('building')) map.setLayoutProperty('building', 'visibility', 'none')
  const firstLabel = map.getStyle().layers.find((l) => l.type === 'symbol')?.id
  map.addLayer(
    {
      id: BUILDINGS_LAYER,
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

/**
 * Fades the map's buildings out (as the 3D street takes over at a lot) or back in. Opacity is one
 * value for the whole layer, so MapLibre animates it without touching the tiles, and it draws a
 * see-through layer nearest-surface-only, so the buildings fade as solid shapes.
 */
export function fadeBuildings(map: MapLibreMap, shown: boolean, durationMs: number): void {
  if (!map.getLayer(BUILDINGS_LAYER)) return
  map.setPaintProperty(BUILDINGS_LAYER, 'fill-extrusion-opacity-transition', { duration: durationMs, delay: 0 })
  map.setPaintProperty(BUILDINGS_LAYER, 'fill-extrusion-opacity', shown ? 1 : 0)
}

function transitionTo(map: MapLibreMap, values: [string, PaintProperty, PaintValue][], durationMs: number): void {
  for (const [layer, property, value] of values) {
    if (!map.getLayer(layer)) continue
    map.setPaintProperty(layer, `${property}-transition` as PaintProperty, { duration: durationMs, delay: 0 })
    map.setPaintProperty(layer, property, value)
  }
}

/**
 * On the way to the ward the base map eases from the UI palette to the ward map's own neutral base
 * (positron with its greens flattened, WardMap/layers.ts), so when the ward map takes over the
 * ground does not change colour; on the way back it eases into the palette again.
 */
export function setWardBase(map: MapLibreMap, ward: boolean, durationMs: number): void {
  const palette = palettes.get(map)
  if (!palette) return
  transitionTo(map, ward ? palette.stock : palette.ours, durationMs)
  if (ward) neutraliseBase(map)
  if (map.getLayer(FLAT_BUILDINGS)) map.setLayoutProperty(FLAT_BUILDINGS, 'visibility', ward ? 'visible' : 'none')
}
