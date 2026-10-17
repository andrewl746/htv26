import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  Color,
  CylinderGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three'
import type { LocalPoint } from '@contracts/types'
import { tokenHex } from '../../styles/tokens'
import { seededRandom } from './geometry'
import { ease, growSpan, progress, type Timeline } from './timeline'
import { useSequenceFrame } from './useSequence'

// Decoration only (MASTERSPEC 6.3): two or three puffy spheres on a short trunk, sized by a seed
// from the tree's position so a street always looks the same. They grow in with the ripple.
const MAX_TREES = 300
const TRUNK = { height: [1.6, 2.6], radiusTop: 0.18, radiusBottom: 0.26 }
const PUFF = { radius: [1.3, 2.3], spread: 0.9, rise: 0.45 }
const PUFF_LIGHTNESS_JITTER = 0.08

interface Part {
  position: Vector3
  scale: Vector3
  distance: number
}

function plan(trees: LocalPoint[]): { trunks: Part[]; puffs: (Part & { lightness: number })[] } {
  const nearest = [...trees].sort((a, b) => Math.hypot(...a) - Math.hypot(...b)).slice(0, MAX_TREES)
  const trunks: Part[] = []
  const puffs: (Part & { lightness: number })[] = []
  for (const point of nearest) {
    const random = seededRandom(point)
    const between = (range: number[]) => range[0] + (range[1] - range[0]) * random()
    const [x, z] = [point[0], -point[1]]
    const distance = Math.hypot(...point)
    const trunkHeight = between(TRUNK.height)
    trunks.push({ position: new Vector3(x, 0, z), scale: new Vector3(1, trunkHeight, 1), distance })
    const count = random() < 0.5 ? 2 : 3
    for (let i = 0; i < count; i++) {
      const r = between(PUFF.radius)
      const angle = random() * Math.PI * 2
      const spread = i === 0 ? 0 : PUFF.spread * random()
      puffs.push({
        position: new Vector3(x + Math.cos(angle) * spread, trunkHeight + r * 0.6 + i * PUFF.rise, z + Math.sin(angle) * spread),
        scale: new Vector3(r, r * 0.9, r),
        distance,
        lightness: (random() - 0.5) * PUFF_LIGHTNESS_JITTER,
      })
    }
  }
  return { trunks, puffs }
}

const scratch = { matrix: new Matrix4(), scale: new Vector3(), still: new Quaternion() }

/** Writes each part's matrix at its point in the ripple. */
function writeGrowth(mesh: InstancedMesh, parts: Part[], t: number, timeline: Timeline): void {
  parts.forEach((part, i) => {
    const p = ease.outBack(progress(t, growSpan(timeline, part.distance)))
    scratch.scale.copy(part.scale).multiplyScalar(Math.max(p, 0.0001))
    mesh.setMatrixAt(i, scratch.matrix.compose(part.position, scratch.still, scratch.scale))
  })
  mesh.instanceMatrix.needsUpdate = true
}

export function Trees({ trees }: { trees: LocalPoint[] }) {
  const { trunks, puffs } = useMemo(() => plan(trees), [trees])
  const resources = useMemo(
    () => ({
      // Unit trunk standing on the ground; each instance scales it to its height.
      trunk: new CylinderGeometry(TRUNK.radiusTop, TRUNK.radiusBottom, 1, 7).translate(0, 0.5, 0),
      puff: new IcosahedronGeometry(1, 1),
      bark: new MeshStandardMaterial({ color: tokenHex('--suplex-trunk'), roughness: 1 }),
      leaves: new MeshStandardMaterial({ color: 'white', roughness: 0.9 }),
    }),
    [],
  )
  useEffect(
    () => () => {
      resources.trunk.dispose()
      resources.puff.dispose()
      resources.bark.dispose()
      resources.leaves.dispose()
    },
    [resources],
  )

  const trunkMesh = useRef<InstancedMesh>(null)
  const puffMesh = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = puffMesh.current
    if (!mesh) return
    const base = new Color(tokenHex('--suplex-tree'))
    puffs.forEach((p, i) => mesh.setColorAt(i, base.clone().offsetHSL(0, 0, p.lightness)))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [puffs])

  // Once every tree is full size the matrices stay put.
  const grown = useRef(false)
  useSequenceFrame((t, { timeline }) => {
    const growing = t < timeline.ripple.end
    if (!growing && grown.current) return
    grown.current = !growing
    if (trunkMesh.current) writeGrowth(trunkMesh.current, trunks, t, timeline)
    if (puffMesh.current) writeGrowth(puffMesh.current, puffs, t, timeline)
  })

  if (!trunks.length) return null
  return (
    <group>
      {/* frustumCulled off: the bounding sphere would be computed while every tree is still size zero */}
      <instancedMesh
        ref={trunkMesh}
        args={[resources.trunk, resources.bark, trunks.length]}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
      <instancedMesh
        ref={puffMesh}
        args={[resources.puff, resources.leaves, puffs.length]}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
    </group>
  )
}
