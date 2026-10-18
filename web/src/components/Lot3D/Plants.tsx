import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { IcosahedronGeometry, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type InstancedMesh } from 'three'
import { ease, growSpan, progress } from './timeline'
import { useSequenceFrame } from './useSequence'
import type { Plant } from './yardKit'

const scratch = { matrix: new Matrix4(), position: new Vector3(), scale: new Vector3(), still: new Quaternion() }

/**
 * A garden's shrubs and flowers as one instanced puff each, grown with their house on the ripple, or
 * (distance 0, the new building's garden) as `ownGrowth` says.
 */
export function Plants({ plants, ownGrowth }: { plants: Plant[]; ownGrowth: () => number }) {
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
  if (plants.length === 0) return null
  return <instancedMesh ref={mesh} args={[resources.puff, resources.leaves, plants.length]} castShadow receiveShadow frustumCulled={false} />
}
