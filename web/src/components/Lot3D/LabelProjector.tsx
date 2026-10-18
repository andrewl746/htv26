import { useMemo, useRef, type RefObject } from 'react'
import { Vector3 } from 'three'
import type { SceneLabel } from './labels'
import { ease, progress } from './timeline'
import { useSequenceFrame } from './useSequence'

/** Gap between a side label and its point, and how far a label rises as it fades in. */
const SIDE_GAP_PX = 8
const RISE_PX = 8
/** The home labels show only while the camera holds still, so they never slide across the building
 *  as it orbits or is dragged: back once it has been still this long (s), fading in slower than they
 *  get out of the way. */
const STILL_AFTER_S = 0.4
const SHOW_FADE_S = 0.35
const HIDE_FADE_S = 0.15
/** Camera travel in one frame (m) below which it counts as still. The orbit moves it about 0.1 m a
 *  frame at 60 fps; a drag or a zoom moves it too. */
const STILL_MOVE_M = 0.002

const ALIGN: Record<SceneLabel['align'], string> = {
  center: 'translate(-50%, -50%)',
  left: `translate(calc(-100% - ${SIDE_GAP_PX}px), -50%)`,
  right: `translate(${SIDE_GAP_PX}px, -50%)`,
}

/**
 * Moves each label element to its point on screen and fades it in on its step of the timeline. The
 * home labels also wait for the camera to hold still.
 */
export function LabelProjector({
  labels,
  elements,
}: {
  labels: SceneLabel[]
  elements: RefObject<(HTMLDivElement | null)[]>
}) {
  const points = useMemo(() => labels.map((l) => new Vector3(...l.position)), [labels])
  const scratch = useMemo(() => new Vector3(), [])
  // Where the camera was, when it last moved, and how far the home labels are shown (0 to 1).
  const motion = useRef({ position: new Vector3(), movedAt: -Infinity, shown: 0 })

  useSequenceFrame((t, { timeline }, frame, delta) => {
    const camera = motion.current
    const now = frame.clock.elapsedTime
    if (frame.camera.position.distanceToSquared(camera.position) > STILL_MOVE_M ** 2) {
      camera.position.copy(frame.camera.position)
      camera.movedAt = now
    }
    camera.shown = now - camera.movedAt >= STILL_AFTER_S
      ? Math.min(1, camera.shown + delta / SHOW_FADE_S)
      : Math.max(0, camera.shown - delta / HIDE_FADE_S)

    labels.forEach((label, i) => {
      const el = elements.current[i]
      if (!el) return
      const { appear } = label
      const span =
        appear.step === 'oldHouse' ? timeline.oldHouse : appear.step === 'fail' ? timeline.fail : timeline.labels[appear.index]
      const p = span ? ease.outCubic(progress(t, span)) : 0
      const ndc = scratch.copy(points[i]).project(frame.camera)
      // Behind the camera, or not yet due.
      if (ndc.z > 1 || p <= 0) {
        el.style.opacity = '0'
        return
      }
      const x = ((ndc.x + 1) / 2) * frame.size.width
      const y = ((1 - ndc.y) / 2) * frame.size.height + (1 - p) * RISE_PX
      el.style.opacity = String(appear.step === 'labels' ? p * camera.shown : p)
      el.style.transform = `translate3d(${x}px, ${y}px, 0) ${ALIGN[label.align]}`
    })
  })

  return null
}
