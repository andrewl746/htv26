import { useEffect, useMemo } from 'react'
import { MeshStandardMaterial } from 'three'
import { tokenHex } from '../../styles/tokens'
import { FLAT } from './geometry'
import { lawnTexture } from './lawn'

// The ground under the street. The classic look keeps the base map's land colour, so the scene
// fades in over the map without a seam; the drawn look is a lawn, with the lot, the street and the
// houses on it.
const LAWN_TILE_M = 6

export function Ground({ radius, drawn }: { radius: number; drawn: boolean }) {
  const material = useMemo(() => {
    if (!drawn) return new MeshStandardMaterial({ color: tokenHex('--suplex-ground'), roughness: 1 })
    const lawn = lawnTexture()
    // The disc's UVs run 0 to 1 across its diameter.
    const map = lawn.map.clone()
    const bump = lawn.bump.clone()
    for (const t of [map, bump]) t.repeat.set((2 * radius) / LAWN_TILE_M, (2 * radius) / LAWN_TILE_M)
    return new MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 0.6, roughness: 1 })
  }, [drawn, radius])
  // The lawn maps are this disc's own clones, and material.dispose() leaves maps alone.
  useEffect(
    () => () => {
      material.map?.dispose()
      material.bumpMap?.dispose()
      material.dispose()
    },
    [material],
  )
  return (
    <mesh rotation={FLAT} receiveShadow>
      <circleGeometry args={[radius, 96]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}
