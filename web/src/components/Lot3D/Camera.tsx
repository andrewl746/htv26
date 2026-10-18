import { useLayoutEffect, useMemo, useRef, type ComponentRef } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Spherical, Vector3 } from 'three'
import { cameraBridge } from './cameraBridge'
import type { Vec3 } from './geometry'
import { useSequenceFrame } from './useSequence'
import { FOV_DEG, REST_TILT_DEG, TARGET_HEIGHT_M } from './view'

// Steps 1 and 7 (MASTERSPEC 6.3). The swoop is the base map's flight: over its last stretch this
// camera follows the map's (cameraBridge) while the scene fades in, then comes to rest with it on
// the rest view. Then a slow orbit, 24 s per turn, that stops while someone drags and resumes 5 s
// after.
const TARGET = new Vector3(0, TARGET_HEIGHT_M, 0)
const ORBIT_PERIOD_S = 24
const ORBIT_IDLE_S = 5
const UP = new Vector3(0, 1, 0)
/** The dev elevation view (debug.ts) looks from far away through a long lens, so it reads nearly flat. */
const ELEVATION_ZOOM = 3.2

export interface FixedPose {
  position: Vec3
  target: Vec3
}

export function Camera({
  lotKey,
  distanceM,
  viewBearingDeg,
  rightInsetPx,
  fixed = null,
}: {
  lotKey: string
  distanceM: number
  viewBearingDeg: number
  rightInsetPx: number
  /** Dev only: hold the camera here (debug.ts). */
  fixed?: FixedPose | null
}) {
  const camera = useRef<ComponentRef<typeof PerspectiveCamera>>(null)
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const size = useThree((s) => s.size)
  const clock = useThree((s) => s.clock)
  const offset = useMemo(() => new Vector3(), [])
  const user = useRef({ dragging: false, releasedAt: -Infinity })

  // Centre the lot in the part of the canvas the result panel does not cover, as the map's padding does.
  useLayoutEffect(() => {
    const cam = camera.current
    if (!cam) return
    const fullWidth = size.width + rightInsetPx
    cam.aspect = fullWidth / size.height
    if (rightInsetPx > 0) cam.setViewOffset(fullWidth, size.height, rightInsetPx, 0, size.width, size.height)
    else cam.clearViewOffset()
    cam.updateProjectionMatrix()
  }, [size, rightInsetPx])

  // A new lot starts at the rest view: on the street side, looking along the view bearing.
  // Spherical azimuth runs from +z toward +x; a camera looking at compass bearing b sits at -b.
  useLayoutEffect(() => {
    const cam = camera.current
    if (!cam) return
    const polar = ((90 - REST_TILT_DEG) * Math.PI) / 180
    const azimuth = (-viewBearingDeg * Math.PI) / 180
    cam.position.setFromSpherical(new Spherical(distanceM, polar, azimuth)).add(TARGET)
    cam.lookAt(TARGET)
    controls.current?.target.copy(TARGET)
    controls.current?.update()
    user.current = { dragging: false, releasedAt: -Infinity }
  }, [lotKey, distanceM, viewBearingDeg])

  useLayoutEffect(() => {
    const ctl = controls.current
    if (!ctl) return
    const start = () => {
      user.current.dragging = true
    }
    const end = () => {
      user.current = { dragging: false, releasedAt: clock.elapsedTime }
    }
    ctl.addEventListener('start', start)
    ctl.addEventListener('end', end)
    return () => {
      ctl.removeEventListener('start', start)
      ctl.removeEventListener('end', end)
    }
  }, [clock])

  // Before the labels and the cutaway read the camera this frame, and after the controls (-1).
  useSequenceFrame((t, { timeline, reduced }, frame, delta) => {
    const cam = camera.current
    const ctl = controls.current
    if (!cam) return
    // While the map is still flying in, be the map's camera.
    const pose = cameraBridge.read?.()
    if (pose) {
      if (ctl) ctl.enabled = false
      cam.position.set(...pose.position)
      cam.lookAt(...pose.target)
      return
    }
    if (fixed) {
      if (ctl) ctl.enabled = false
      cam.position.set(...fixed.position)
      cam.lookAt(...fixed.target)
      if (cam.zoom !== ELEVATION_ZOOM) {
        cam.zoom = ELEVATION_ZOOM
        cam.updateProjectionMatrix()
      }
      return
    }
    if (ctl && !ctl.enabled) ctl.enabled = true
    const idle = !user.current.dragging && frame.clock.elapsedTime - user.current.releasedAt >= ORBIT_IDLE_S
    if (reduced || t < timeline.orbitStart || !idle) return
    offset.copy(cam.position).sub(TARGET).applyAxisAngle(UP, ((2 * Math.PI) / ORBIT_PERIOD_S) * delta)
    cam.position.copy(TARGET).add(offset)
    cam.lookAt(TARGET)
  }, -0.5)

  return (
    <>
      <PerspectiveCamera ref={camera} makeDefault manual fov={FOV_DEG} near={1} far={1000} />
      <OrbitControls
        ref={controls}
        makeDefault
        target={[TARGET.x, TARGET.y, TARGET.z]}
        enableDamping
        enablePan={false}
        minDistance={15}
        maxDistance={120}
        maxPolarAngle={1.35}
      />
    </>
  )
}
