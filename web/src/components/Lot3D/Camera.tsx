import { useLayoutEffect, useMemo, useRef, type ComponentRef } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Spherical, Vector3 } from 'three'
import { ease, lerp, progress } from './timeline'
import { useSequenceFrame } from './useSequence'
import { FOV_DEG, START_BEARING_DEG, SWOOP_START_M, TARGET_HEIGHT_M } from './view'

// Step 1 (MASTERSPEC 6.3): the camera swoops from top-down at 120 m to a 35° tilt on the street side
// of the lot, turning from the map's north-up as it goes, and settles at a distance sized to the
// lot (restDistance in view.ts). Step 7: a slow orbit, 24 s per turn, that stops while someone
// drags and resumes 5 s after.
const TILT_DEG = 35
const TARGET = new Vector3(0, TARGET_HEIGHT_M, 0)
/** Straight down has no heading, so the swoop starts a hair off vertical. */
const SWOOP_START_POLAR = 0.02
const ORBIT_PERIOD_S = 24
const ORBIT_IDLE_S = 5
/** A lot with no measurable frontage has no bearing; look from the south. */
const DEFAULT_BEARING_DEG = 180
const UP = new Vector3(0, 1, 0)

export function Camera({
  frontBearingDeg,
  distanceM,
  rightInsetPx,
}: {
  frontBearingDeg: number | null
  distanceM: number
  rightInsetPx: number
}) {
  const camera = useRef<ComponentRef<typeof PerspectiveCamera>>(null)
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const size = useThree((s) => s.size)
  const clock = useThree((s) => s.clock)

  // Spherical azimuth runs from +z toward +x. Looking down with a compass bearing at the top of the
  // screen puts the camera on the opposite side; at rest it sits on the street side.
  const startAzimuth = (-START_BEARING_DEG * Math.PI) / 180
  const restAzimuth = Math.PI - ((frontBearingDeg ?? DEFAULT_BEARING_DEG) * Math.PI) / 180
  const turn = Math.atan2(Math.sin(restAzimuth - startAzimuth), Math.cos(restAzimuth - startAzimuth))
  const restPolar = ((90 - TILT_DEG) * Math.PI) / 180
  const scratch = useMemo(() => ({ spherical: new Spherical(), offset: new Vector3() }), [])
  const user = useRef({ dragging: false, releasedAt: -Infinity })

  // Centre the lot in the part of the canvas the result panel does not cover.
  useLayoutEffect(() => {
    const cam = camera.current
    if (!cam) return
    const fullWidth = size.width + rightInsetPx
    cam.aspect = fullWidth / size.height
    if (rightInsetPx > 0) cam.setViewOffset(fullWidth, size.height, rightInsetPx, 0, size.width, size.height)
    else cam.clearViewOffset()
    cam.updateProjectionMatrix()
  }, [size, rightInsetPx])

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

  useSequenceFrame((t, { timeline, reduced }, frame, delta) => {
    const cam = camera.current
    const ctl = controls.current
    if (!cam || !ctl) return
    if (t <= timeline.swoop.end + delta) {
      // Hand over exactly at rest, even if the last swoop frame was skipped.
      ctl.enabled = false
      const p = ease.outCubic(progress(t, timeline.swoop))
      scratch.spherical.set(
        lerp(SWOOP_START_M, distanceM, p),
        lerp(SWOOP_START_POLAR, restPolar, p),
        startAzimuth + turn * p,
      )
      cam.position.setFromSpherical(scratch.spherical).add(TARGET)
      cam.lookAt(TARGET)
      return
    }
    ctl.enabled = true
    const idle = !user.current.dragging && frame.clock.elapsedTime - user.current.releasedAt >= ORBIT_IDLE_S
    if (reduced || t < timeline.orbitStart || !idle) return
    scratch.offset.copy(cam.position).sub(TARGET).applyAxisAngle(UP, ((2 * Math.PI) / ORBIT_PERIOD_S) * delta)
    cam.position.copy(TARGET).add(scratch.offset)
    cam.lookAt(TARGET)
  })

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
        maxDistance={SWOOP_START_M}
        maxPolarAngle={1.35}
      />
    </>
  )
}
