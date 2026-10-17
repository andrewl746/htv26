import { useEffect, useMemo, useRef } from 'react'
import {
  CanvasTexture,
  EdgesGeometry,
  ExtrudeGeometry,
  LineBasicMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  type Group,
  type Material,
  type Mesh,
} from 'three'
import { token, tokenHex } from '../../styles/tokens'
import type { FailSlab } from './failSlabs'
import { shapeFrom } from './geometry'
import { ease, progress } from './timeline'
import { useSequenceFrame } from './useSequence'

// J8: the slab where a design fails, standing over that part of the building (failSlabs.ts). Red
// for doesn't fit, the borderline stripes for too close to call; its label (labels.ts) names the
// rule, so the colour is never the only signal. It rises out of the ground once the floors land.
const RED_OPACITY = 0.42
/** A little light of its own, so the slab still reads red over dark cladding. */
const RED_GLOW = 0.3
const EDGE_OPACITY = 0.9
/** A little above the parapet, so the slab's top reads as a lid. */
const TOP_CLEARANCE_M = 0.08
/** Stripes repeat every this many metres on the slab's faces. */
const STRIPE_PERIOD_M = 0.6
const STRIPE_TEXTURE_PX = 64
const STRIPE_SHARE = 0.4
const STRIPE_BASE_ALPHA = 0.38
const STRIPE_ALPHA = 0.85

/** Diagonal stripes on the pale borderline base, tileable, the 3D twin of the map's pattern. */
function stripeTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = STRIPE_TEXTURE_PX
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const n = STRIPE_TEXTURE_PX
    ctx.globalAlpha = STRIPE_BASE_ALPHA
    ctx.fillStyle = token('--suplex-borderline-base').color
    ctx.fillRect(0, 0, n, n)
    ctx.globalAlpha = STRIPE_ALPHA
    ctx.strokeStyle = token('--suplex-borderline-stripe').color
    ctx.lineWidth = n * STRIPE_SHARE * Math.SQRT1_2
    // The stripe and its two wrapped copies, so the tile repeats without a seam.
    for (const offset of [-n, 0, n]) {
      ctx.beginPath()
      ctx.moveTo(offset, n)
      ctx.lineTo(offset + n, 0)
      ctx.stroke()
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = texture.wrapT = RepeatWrapping
  // Extruded faces carry UVs in metres.
  texture.repeat.set(1 / STRIPE_PERIOD_M, 1 / STRIPE_PERIOD_M)
  return texture
}

export function FailSlices({ slab }: { slab: FailSlab }) {
  const height = slab.top + TOP_CLEARANCE_M - slab.bottom
  const geometries = useMemo(
    () =>
      slab.polygons.map((polygon) => {
        const body = new ExtrudeGeometry(shapeFrom(polygon), { depth: height, bevelEnabled: false }).rotateX(-Math.PI / 2)
        return { body, edges: new EdgesGeometry(body, 30) }
      }),
    [slab, height],
  )
  useEffect(
    () => () =>
      geometries.forEach((g) => {
        g.body.dispose()
        g.edges.dispose()
      }),
    [geometries],
  )

  const materials = useMemo(() => {
    const borderline = slab.kind === 'borderline'
    const map = borderline ? stripeTexture() : null
    const edgeColour = tokenHex(borderline ? '--suplex-borderline-stripe' : '--suplex-fail')
    const made = {
      body: new MeshStandardMaterial({
        color: borderline ? 'white' : edgeColour,
        emissive: borderline ? 'black' : edgeColour,
        emissiveIntensity: borderline ? 0 : RED_GLOW,
        map,
        transparent: true,
        opacity: borderline ? 1 : RED_OPACITY,
        roughness: 0.6,
        depthWrite: false,
        // Drawn over the building's walls where they share a plane.
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
      edges: new LineBasicMaterial({ color: edgeColour, transparent: true, opacity: EDGE_OPACITY }),
      map,
    }
    // The fade in reads each material's full opacity back from here.
    made.body.userData.fullOpacity = made.body.opacity
    made.edges.userData.fullOpacity = EDGE_OPACITY
    return made
  }, [slab.kind])
  useEffect(
    () => () => {
      materials.body.dispose()
      materials.edges.dispose()
      materials.map?.dispose()
    },
    [materials],
  )

  const group = useRef<Group>(null)
  useSequenceFrame((t, { timeline }) => {
    const g = group.current
    if (!g) return
    const p = progress(t, timeline.fail)
    g.visible = p > 0
    g.scale.y = Math.max(ease.outCubic(p), 0.001)
    g.traverse((object) => {
      const material = (object as Mesh).material as Material | undefined
      if (material) material.opacity = (material.userData.fullOpacity as number) * p
    })
  })

  return (
    <group ref={group} position={[0, slab.bottom, 0]} visible={false}>
      {geometries.map((g, i) => (
        <group key={i}>
          <mesh geometry={g.body} material={materials.body} renderOrder={4} dispose={null} />
          <lineSegments geometry={g.edges} material={materials.edges} renderOrder={5} dispose={null} />
        </group>
      ))}
    </group>
  )
}
