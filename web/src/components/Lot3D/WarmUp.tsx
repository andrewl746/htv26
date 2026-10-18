import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Line } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { CanvasTexture, Color, MeshDepthMaterial, MeshStandardMaterial, WebGLRenderTarget, type Group, type InstancedMesh } from 'three'
import type { DesignId } from '@contracts/types'
import { designById } from '../../designs'
import { cutawayDepthMaterial, withCutaway } from './cutaway'
import { LOOK } from './look'
import { FACADES } from './models'
import { facadeOf } from './models/build'

/** Frames drawn on the hidden canvas after compiling, so the passes that draw per frame compile too. */
const WARM_FRAMES = 3
/**
 * The outline's points, made once: drei's Line builds a new geometry when its points change and
 * disposes its material with the old one, which released the compiled program whenever WarmUp
 * rendered again (the lot outline then compiled mid-sequence).
 */
const LINE_POINTS: [number, number, number][] = [
  [0, 0, 0],
  [1, 0, 0],
]

/** Runs when the page is idle (or soon, where there is no requestIdleCallback). */
function whenIdle(run: () => void) {
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run)
  else window.setTimeout(run, 0)
}

/** Builds each drawn design's facade, one per idle moment, so an address does not wait for its design's (tens of ms). */
function buildFacadesWhenIdle() {
  const ids = (Object.keys(FACADES) as DesignId[]).filter((id) => FACADES[id])
  const next = () => {
    const id = ids.shift()
    const model = id && FACADES[id]
    if (!id || !model) return
    facadeOf(model, designById(id))
    whenIdle(next)
  }
  whenIdle(next)
}

/**
 * One object for each kind of shader the lot scene draws, compiled while the landing page sits
 * idle. Otherwise three compiles each one the first time it appears, and on ANGLE over Direct3D
 * (integrated GPUs on Windows) that froze the first seconds of the 3D sequence for 2.6 s.
 *
 * Variants: plain standard, opaque (ground, floors, pin, the house on the lot) and transparent
 * (the lot's flat layers); cutaway standard (neighbours), cutaway instanced (tree trunks) and
 * cutaway instanced with per-instance colour (tree tops), each with its sinking shadow; and the
 * dashed lot outline. The drawn
 * look adds textured standard (the designs' cladding, the street), textured cutaway (neighbour
 * walls), textured cutaway with vertex colours (roofs), faceted instanced tops, the striped slab,
 * the old house's own (unsunk) roof and doors, the neighbours' doors (cutaway with vertex colours),
 * the gardens' faceted shrubs with per-instance colour, and the passes that draw every frame
 * (ambient occlusion, contact shadows), which a few frames on the hidden canvas compile.
 * compileAsync covers the main pass; the frames cover the shadow pass. The objects then stay
 * mounted but hidden, because disposing their materials would release the compiled programs.
 *
 * The shadow pass draws everything without a depth material of its own with one shared material,
 * which three re-keys only where it switches between plain and instanced meshes, taking the map of
 * the mesh at that point (three 0.186). Which of its variants a scene needs depends on draw order,
 * so the textured and the instanced shadows here each get a plain depth material of their own: it
 * compiles the same program, whatever the order.
 *
 * Once that is done, the drawn designs' facades are built in the landing page's idle time too.
 */
export function WarmUp() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const advance = useThree((s) => s.advance)
  const group = useRef<Group>(null)
  const coloured = useRef<InstancedMesh>(null)
  const faceted = useRef<InstancedMesh>(null)
  const shrubs = useRef<InstancedMesh>(null)
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
      doors: withCutaway(new MeshStandardMaterial({ vertexColors: true })),
      oldDoors: new MeshStandardMaterial({ vertexColors: true }),
      oldRoof: new MeshStandardMaterial({ map: texture, bumpMap: texture, vertexColors: true }),
      shrubs: new MeshStandardMaterial({ flatShading: true }),
      texturedDepth: new MeshDepthMaterial(),
      instancedDepth: new MeshDepthMaterial(),
    }
  }, [])

  // Per-instance colour has to exist before compiling for that variant to be built.
  useLayoutEffect(() => {
    coloured.current?.setColorAt(0, new Color('white'))
    faceted.current?.setColorAt(0, new Color('white'))
    shrubs.current?.setColorAt(0, new Color('white'))
  }, [])

  useEffect(() => {
    let live = true
    // The drawn look draws the scene into the effects' render target, in linear colour and tone
    // mapped afterwards (Effects.tsx), so its programs differ from the canvas's: compile those.
    // Compiled for the canvas, the real ones all compiled in the first frames instead, at once.
    const target = drawn ? new WebGLRenderTarget(1, 1) : null
    const onTarget = <T,>(draw: () => T): T => {
      const previous = gl.getRenderTarget()
      gl.setRenderTarget(target)
      try {
        return draw()
      } finally {
        gl.setRenderTarget(previous)
      }
    }
    onTarget(() => gl.compileAsync(scene, camera)).then(() => {
      if (!live || !group.current) return
      onTarget(() => gl.render(scene, camera))
      target?.dispose()
      for (let i = 0; i < WARM_FRAMES; i++) advance(performance.now())
      group.current.visible = false
      if (drawn) buildFacadesWhenIdle()
    })
    return () => {
      live = false
      target?.dispose()
    }
  }, [gl, scene, camera, advance, drawn])

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
      <mesh material={materials.cutaway} customDepthMaterial={cutawayDepthMaterial} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <instancedMesh args={[undefined, materials.instanced, 1]} customDepthMaterial={cutawayDepthMaterial} castShadow receiveShadow>
        <boxGeometry />
      </instancedMesh>
      <instancedMesh
        ref={coloured}
        args={[undefined, materials.coloured, 1]}
        customDepthMaterial={cutawayDepthMaterial}
        castShadow
        receiveShadow
      >
        <boxGeometry />
      </instancedMesh>
      <Line
        points={LINE_POINTS}
        dashed
        dashSize={1}
        gapSize={1}
      />
      {drawn && (
        <>
          <mesh material={materials.textured} customDepthMaterial={materials.texturedDepth} castShadow receiveShadow>
            <boxGeometry />
          </mesh>
          <mesh material={materials.texturedCut} customDepthMaterial={cutawayDepthMaterial} castShadow receiveShadow>
            <boxGeometry />
          </mesh>
          <mesh material={materials.roof} customDepthMaterial={cutawayDepthMaterial} castShadow receiveShadow>
            <boxGeometry />
          </mesh>
          <instancedMesh
            ref={faceted}
            args={[undefined, materials.faceted, 1]}
            customDepthMaterial={cutawayDepthMaterial}
            castShadow
            receiveShadow
          >
            <boxGeometry />
          </instancedMesh>
          <mesh material={materials.striped}>
            <boxGeometry />
          </mesh>
          <mesh material={materials.doors} customDepthMaterial={cutawayDepthMaterial} castShadow receiveShadow>
            <boxGeometry />
          </mesh>
          <mesh material={materials.oldDoors} castShadow receiveShadow>
            <boxGeometry />
          </mesh>
          <mesh material={materials.oldRoof} castShadow receiveShadow>
            <boxGeometry />
          </mesh>
          <instancedMesh
            ref={shrubs}
            args={[undefined, materials.shrubs, 1]}
            customDepthMaterial={materials.instancedDepth}
            castShadow
            receiveShadow
          >
            <boxGeometry />
          </instancedMesh>
        </>
      )}
    </group>
  )
}
