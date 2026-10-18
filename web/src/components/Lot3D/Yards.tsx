import { useEffect, useMemo, useRef, useState } from 'react'
import { BufferAttribute, BufferGeometry, type Mesh, type MeshStandardMaterial } from 'three'
import type { CityYards } from './cityPlan'
import { Plants } from './Plants'
import { useSequenceFrame } from './useSequence'
import { DISTANCE_ATTRIBUTE } from './yardKit'
import { yardMaterial, type YardUniforms } from './yardMaterial'

// Every neighbouring house's back yard (yardPlan.ts, planned in cityPlan.ts), drawn as one mesh that
// grows in with the ripple on the GPU (yardMaterial.ts). Shrubs and flowers are instanced puffs.
// Shadows join once the ripple is over: the shadow pass would draw the yards ungrown.

export function Yards({ yards }: { yards: CityYards }) {
  useEffect(() => () => yards.geometry?.dispose(), [yards])
  const material = useMemo(() => yardMaterial(false), [])
  useEffect(() => () => material.dispose(), [material])

  const mesh = useRef<Mesh>(null)
  const [shadows, setShadows] = useState(false)
  const shadowsOn = useRef(false)
  useSequenceFrame((t, { timeline }) => {
    const m = mesh.current
    if (!m) return
    const u = (m.material as MeshStandardMaterial).userData.uniforms as YardUniforms
    u.uYardTime.value = t
    u.uRippleStart.value = timeline.ripple.start
    u.uDelayPerM.value = timeline.delayPerM
    u.uMaxDelay.value = timeline.ripple.end - timeline.ripple.start - timeline.growS
    u.uGrowS.value = timeline.growS
    if (!shadowsOn.current && t >= timeline.ripple.end) {
      shadowsOn.current = true
      setShadows(true)
    }
  })

  return (
    <group>
      {yards.geometry && <mesh ref={mesh} geometry={yards.geometry} material={material} castShadow={shadows} receiveShadow dispose={null} />}
      <Plants plants={yards.plants} ownGrowth={() => 1} />
    </group>
  )
}

/**
 * Mounted from the start, beside WarmUp, so the yard shader compiles while the landing page sits
 * idle rather than as the first lot opens: one triangle whose corners never leave the origin.
 */
export function YardWarmUp() {
  const parts = useMemo(() => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(9), 3))
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]), 3))
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(9), 3))
    geometry.setAttribute(DISTANCE_ATTRIBUTE, new BufferAttribute(new Float32Array(3), 1))
    return { geometry, material: yardMaterial(false) }
  }, [])
  useEffect(
    () => () => {
      parts.geometry.dispose()
      parts.material.dispose()
    },
    [parts],
  )
  return <mesh geometry={parts.geometry} material={parts.material} receiveShadow frustumCulled={false} />
}
