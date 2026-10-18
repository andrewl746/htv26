import { useEffect, useMemo } from 'react'
import { MeshStandardMaterial } from 'three'
import type { RoadLayers } from './roadMesh'
import { asphaltTexture, sidewalkTexture } from './textures'

// The streets round the lot from the map (roadMesh.ts, planned in cityPlan.ts): asphalt, sidewalks,
// footpaths, parking lots and their lines, sports fields, running tracks and schoolyards. They are
// there from the street's first frame, like the ground they lie on; the lot's own street
// (Frontage.tsx) still unrolls with the ripple. The materials are the frontage street's kinds
// (textured, and plain), whose shaders WarmUp compiles.

const COLOUR = {
  asphalt: '#45484c',
  sidewalk: '#cdc9c1',
  joint: '#a9a49b',
  path: '#d3cbbd',
  line: '#f2f0ea',
  field: '#79a957',
  track: '#b4604a',
  play: '#bdb7a8',
}
const ASPHALT_TILE_M = 4
const SIDEWALK_SLAB_M = 1.5

export function Roads({ layers }: { layers: RoadLayers }) {
  useEffect(() => () => Object.values(layers).forEach((g) => g?.dispose()), [layers])

  const materials = useMemo(() => {
    const asphalt = asphaltTexture(COLOUR.asphalt, ASPHALT_TILE_M)
    const walk = sidewalkTexture(COLOUR.sidewalk, COLOUR.joint, SIDEWALK_SLAB_M)
    return {
      textures: [asphalt.map, asphalt.bump, walk.map, walk.bump],
      byLayer: {
        asphalt: new MeshStandardMaterial({ map: asphalt.map, bumpMap: asphalt.bump, bumpScale: 0.4, roughness: 0.95 }),
        sidewalk: new MeshStandardMaterial({ map: walk.map, bumpMap: walk.bump, bumpScale: 0.6, roughness: 0.9 }),
        path: new MeshStandardMaterial({ color: COLOUR.path, roughness: 0.95 }),
        lines: new MeshStandardMaterial({ color: COLOUR.line, roughness: 0.8 }),
        fields: new MeshStandardMaterial({ color: COLOUR.field, roughness: 1 }),
        track: new MeshStandardMaterial({ color: COLOUR.track, roughness: 0.95 }),
        play: new MeshStandardMaterial({ color: COLOUR.play, roughness: 1 }),
      } satisfies Record<keyof RoadLayers, MeshStandardMaterial>,
    }
  }, [])
  useEffect(
    () => () => {
      Object.values(materials.byLayer).forEach((m) => m.dispose())
      materials.textures.forEach((t) => t.dispose())
    },
    [materials],
  )

  return (
    <group>
      {(Object.keys(layers) as (keyof RoadLayers)[]).map((name) => {
        const geometry = layers[name]
        return geometry ? <mesh key={name} geometry={geometry} material={materials.byLayer[name]} receiveShadow dispose={null} /> : null
      })}
    </group>
  )
}
