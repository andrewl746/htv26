import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Line } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Color, MeshStandardMaterial, type Group, type InstancedMesh } from 'three'
import { withCutaway } from './cutaway'

/**
 * One object for each kind of shader the lot scene draws, compiled while the landing page sits
 * idle. Otherwise three compiles each one the first time it appears, and on ANGLE over Direct3D
 * (integrated GPUs on Windows) that froze the first seconds of the 3D sequence for 2.6 s.
 *
 * Variants: plain standard, opaque (ground, floors, pin, the house on the lot) and transparent
 * (the lot's flat layers); cutaway standard (neighbours), cutaway instanced (tree trunks) and
 * cutaway instanced with per-instance colour (tree tops); and the dashed lot outline.
 * compileAsync covers the main pass; one render, on the still-hidden canvas, covers the shadow
 * pass. The objects then stay mounted but hidden, because disposing their materials would release
 * the compiled programs.
 */
export function WarmUp() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const group = useRef<Group>(null)
  const coloured = useRef<InstancedMesh>(null)
  const cutaway = useMemo(
    () => ({
      mesh: withCutaway(new MeshStandardMaterial()),
      instanced: withCutaway(new MeshStandardMaterial()),
      coloured: withCutaway(new MeshStandardMaterial()),
    }),
    [],
  )

  // Per-instance colour has to exist before compiling for that variant to be built.
  useLayoutEffect(() => {
    coloured.current?.setColorAt(0, new Color('white'))
  }, [])

  useEffect(() => {
    let live = true
    gl.compileAsync(scene, camera).then(() => {
      if (!live || !group.current) return
      gl.render(scene, camera)
      group.current.visible = false
    })
    return () => {
      live = false
    }
  }, [gl, scene, camera])

  return (
    <group ref={group}>
      <mesh castShadow receiveShadow>
        <boxGeometry />
        <meshStandardMaterial />
      </mesh>
      <mesh receiveShadow>
        <boxGeometry />
        <meshStandardMaterial transparent opacity={0.5} depthWrite={false} />
      </mesh>
      <mesh material={cutaway.mesh} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <instancedMesh args={[undefined, cutaway.instanced, 1]} castShadow receiveShadow>
        <boxGeometry />
      </instancedMesh>
      <instancedMesh ref={coloured} args={[undefined, cutaway.coloured, 1]} castShadow receiveShadow>
        <boxGeometry />
      </instancedMesh>
      <Line
        points={[
          [0, 0, 0],
          [1, 0, 0],
        ]}
        dashed
        dashSize={1}
        gapSize={1}
      />
    </group>
  )
}
