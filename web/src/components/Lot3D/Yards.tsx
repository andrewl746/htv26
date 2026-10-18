import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  BufferAttribute,
  BufferGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type IUniform,
} from 'three'
import type { ContextBuilding, LocalPoint } from '@contracts/types'
import type { StreetFrame } from './streetFrame'
import { ease, growSpan, progress } from './timeline'
import { useSequenceFrame } from './useSequence'
import { DISTANCE_ATTRIBUTE, Pieces, YardKit, type Plant } from './yardKit'
import { furnishYard, planYards } from './yardPlan'

// Every neighbouring house's back yard (yards.ts), drawn as one mesh that grows in with the ripple:
// each vertex carries its house's distance, and the vertex shader raises it out of the ground on that
// house's step of the ripple, so the yards need no mesh of their own while they grow. Shrubs and
// flowers are instanced puffs, like the trees'. Shadows join once the ripple is over.

type YardUniforms = Record<'uYardTime' | 'uRippleStart' | 'uDelayPerM' | 'uMaxDelay' | 'uGrowS', IUniform<number>>

/**
 * The material every garden piece is drawn with: vertex colours, and growth by distance. With
 * uRippleStart far in the past (the new building's garden) everything stands at full height; far in
 * the future, every vertex sits at the origin and nothing shows.
 */
export function yardMaterial(uniforms: YardUniforms): MeshStandardMaterial {
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float ${DISTANCE_ATTRIBUTE};
uniform float uYardTime;
uniform float uRippleStart;
uniform float uDelayPerM;
uniform float uMaxDelay;
uniform float uGrowS;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
{
  float yardStart = uRippleStart + max(0.0, min(${DISTANCE_ATTRIBUTE} * uDelayPerM, uMaxDelay));
  float yardP = clamp((uYardTime - yardStart) / max(uGrowS, 1e-3), 0.0, 1.0);
  float yardQ = yardP - 1.0;
  // ease.outBack: a slight overshoot, like the houses.
  float yardK = 1.0 + 2.2 * yardQ * yardQ * yardQ + 1.2 * yardQ * yardQ;
  transformed = yardP <= 0.0 ? vec3(0.0) : vec3(transformed.x, transformed.y * yardK, transformed.z);
}`,
      )
  }
  material.customProgramCacheKey = () => 'suplex-yard'
  return material
}

export function yardUniforms(grown: boolean): YardUniforms {
  return {
    uYardTime: { value: 0 },
    uRippleStart: { value: grown ? -1e6 : 1e6 },
    uDelayPerM: { value: 0 },
    uMaxDelay: { value: 0 },
    uGrowS: { value: 1 },
  }
}

const scratch = { matrix: new Matrix4(), position: new Vector3(), scale: new Vector3(), still: new Quaternion() }

/** Shrubs and flowers: one instanced puff each, grown with their house (or with the new building's garden). */
export function usePlants(plants: Plant[], ownGrowth: () => number) {
  const resources = useMemo(
    () => ({ puff: new IcosahedronGeometry(1, 1), leaves: new MeshStandardMaterial({ color: 'white', roughness: 0.9, flatShading: true }) }),
    [],
  )
  useEffect(
    () => () => {
      resources.puff.dispose()
      resources.leaves.dispose()
    },
    [resources],
  )
  const mesh = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    plants.forEach((p, i) => m.setColorAt(i, p.colour))
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [plants])
  const done = useRef(false)
  useSequenceFrame((t, { timeline }) => {
    const m = mesh.current
    const own = ownGrowth()
    const settled = t > timeline.ripple.end && own >= 1
    if (!m || (settled && done.current)) return
    done.current = settled
    plants.forEach((p, i) => {
      const grow = p.distance > 0 ? ease.outBack(progress(t, growSpan(timeline, p.distance))) : own
      scratch.scale.setScalar(Math.max(p.scale * grow, 0.0001))
      m.setMatrixAt(i, scratch.matrix.compose(scratch.position.set(p.x, p.y, p.z), scratch.still, scratch.scale))
    })
    m.instanceMatrix.needsUpdate = true
  })
  return plants.length > 0 ? (
    <instancedMesh ref={mesh} args={[resources.puff, resources.leaves, plants.length]} castShadow receiveShadow frustumCulled={false} />
  ) : null
}

export function Yards({ buildings, street, lot }: { buildings: ContextBuilding[]; street: StreetFrame; lot: LocalPoint[] }) {
  const yards = useMemo(() => {
    const pieces = new Pieces(true)
    const plants: Plant[] = []
    for (const yard of planYards(buildings, street, lot)) {
      furnishYard(new YardKit(yard.frame, pieces, plants, yard.distance), yard.width, yard.depth, yard.seed)
    }
    return { geometry: pieces.empty ? null : pieces.geometry(), plants }
  }, [buildings, street, lot])
  useEffect(() => () => yards.geometry?.dispose(), [yards])

  const uniforms = useMemo(() => yardUniforms(false), [])
  const material = useMemo(() => yardMaterial(uniforms), [uniforms])
  useEffect(() => () => material.dispose(), [material])

  const [shadows, setShadows] = useState(false)
  const shadowsOn = useRef(false)
  useSequenceFrame((t, { timeline }) => {
    uniforms.uYardTime.value = t
    uniforms.uRippleStart.value = timeline.ripple.start
    uniforms.uDelayPerM.value = timeline.delayPerM
    uniforms.uMaxDelay.value = timeline.ripple.end - timeline.ripple.start - timeline.growS
    uniforms.uGrowS.value = timeline.growS
    // The shadow pass draws them ungrown, so they cast shadows only once they stand.
    if (!shadowsOn.current && t >= timeline.ripple.end) {
      shadowsOn.current = true
      setShadows(true)
    }
  })
  const plants = usePlants(yards.plants, () => 1)

  return (
    <group>
      {yards.geometry && <mesh geometry={yards.geometry} material={material} castShadow={shadows} receiveShadow dispose={null} />}
      {plants}
    </group>
  )
}

/**
 * Mounted from the start, beside WarmUp, so the yard shader compiles while the landing page sits
 * idle rather than as the first lot opens: a single box whose vertices never leave the origin.
 */
export function YardWarmUp() {
  const parts = useMemo(() => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(9), 3))
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]), 3))
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(9), 3))
    geometry.setAttribute(DISTANCE_ATTRIBUTE, new BufferAttribute(new Float32Array(3), 1))
    return { geometry, material: yardMaterial(yardUniforms(false)) }
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
