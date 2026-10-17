import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Line } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { CanvasTexture, Color, MeshStandardMaterial, type Group, type InstancedMesh } from 'three'
import { withCutaway } from './cutaway'
import { LOOK } from './look'

/** Frames drawn on the hidden canvas after compiling, so the passes that draw per frame compile too. */
const WARM_FRAMES = 3

/**
 * One object for each kind of shader the lot scene draws, compiled while the landing page sits
 * idle. Otherwise three compiles each one the first time it appears, and on ANGLE over Direct3D
 * (integrated GPUs on Windows) that froze the first seconds of the 3D sequence for 2.6 s.
 *
 * Variants: plain standard, opaque (ground, floors, pin, the house on the lot) and transparent
 * (the lot's flat layers); cutaway standard (neighbours), cutaway instanced (tree trunks) and
 * cutaway instanced with per-instance colour (tree tops); and the dashed lot outline. The drawn
 * look adds textured standard (the designs' cladding, the street), textured cutaway (neighbour
 * walls), textured cutaway with vertex colours (roofs), faceted instanced tops, the striped slab,
 * and the passes that draw every frame (ambient occlusion, contact shadows), which a few frames on
 * the hidden canvas compile. compileAsync covers the main pass; the frames cover the shadow pass.
 * The objects then stay mounted but hidden, because disposing their materials would release the
 * compiled programs.
 */
export function WarmUp() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const advance = useThree((s) => s.advance)
  const group = useRef<Group>(null)
  const coloured = useRef<InstancedMesh>(null)
  const faceted = useRef<InstancedMesh>(null)
  const drawn = LOOK === 'drawn'
  const materials = useMemo(() => {
    const texture = new CanvasTexture(document.createElement('canvas'))
    return {
      texture,
      cutaway: withCutaway(new MeshStandardMaterial()),
      instanced: withCutaway(new MeshStandardMaterial()),
      coloured: withCutaway(new MeshStandardMaterial()),
      textured: new MeshStandardMaterial({ map: texture, bumpMap: texture }),
      texturedCut: withCutaway(new MeshStandardMaterial({ map: texture, bumpMap: texture })),
      roof: withCutaway(new MeshStandardMaterial({ map: texture, bumpMap: texture, vertexColors: true })),
      faceted: withCutaway(new MeshStandardMaterial({ flatShading: true })),
      striped: new MeshStandardMaterial({ map: texture, transparent: true, depthWrite: false }),
    }
  }, [])

  // Per-instance colour has to exist before compiling for that variant to be built.
  useLayoutEffect(() => {
    coloured.current?.setColorAt(0, new Color('white'))
    faceted.current?.setColorAt(0, new Color('white'))
  }, [])

  useEffect(() => {
    let live = true
    gl.compileAsync(scene, camera).then(() => {
      if (!live || !group.current) return
      gl.render(scene, camera)
      for (let i = 0; i < WARM_FRAMES; i++) advance(performance.now())
      group.current.visible = false
    })
    return () => {
      live = false
    }
  }, [gl, scene, camera, advance])

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
      <mesh material={materials.cutaway} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <instancedMesh args={[undefined, materials.instanced, 1]} castShadow receiveShadow>
        <boxGeometry />
      </instancedMesh>
      <instancedMesh ref={coloured} args={[undefined, materials.coloured, 1]} castShadow receiveShadow>
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
      {drawn && (
        <>
          <mesh material={materials.textured} castShadow receiveShadow>
            <boxGeometry />
          </mesh>
          <mesh material={materials.texturedCut} castShadow receiveShadow>
            <boxGeometry />
          </mesh>
          <mesh material={materials.roof} castShadow receiveShadow>
            <boxGeometry />
          </mesh>
          <instancedMesh ref={faceted} args={[undefined, materials.faceted, 1]} castShadow receiveShadow>
            <boxGeometry />
          </instancedMesh>
          <mesh material={materials.striped}>
            <boxGeometry />
          </mesh>
        </>
      )}
    </group>
  )
}
