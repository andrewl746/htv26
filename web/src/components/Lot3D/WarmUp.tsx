import { useEffect, useLayoutEffect, useRef } from 'react'
import { Line } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Color, type Group, type InstancedMesh } from 'three'

/**
 * One object for each kind of shader the lot scene draws, compiled while the landing page sits
 * idle. Otherwise three compiles each one the first time it appears, and on ANGLE over Direct3D
 * (integrated GPUs on Windows) that froze the first seconds of the 3D sequence for 2.6 s.
 *
 * Variants: opaque and transparent standard materials, instanced (tree trunks), instanced with
 * per-instance colour (tree tops), and the dashed lot outline. compileAsync covers the main pass;
 * one render, on the still-hidden canvas, covers the shadow pass. The objects then stay mounted
 * but hidden, because disposing their materials would release the compiled programs.
 */
export function WarmUp() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const group = useRef<Group>(null)
  const coloured = useRef<InstancedMesh>(null)

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
      <instancedMesh args={[undefined, undefined, 1]} castShadow receiveShadow>
        <boxGeometry />
        <meshStandardMaterial />
      </instancedMesh>
      <instancedMesh ref={coloured} args={[undefined, undefined, 1]} castShadow receiveShadow>
        <boxGeometry />
        <meshStandardMaterial />
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
