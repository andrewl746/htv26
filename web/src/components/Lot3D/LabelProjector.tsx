import { useMemo, type RefObject } from 'react'
import { Vector3 } from 'three'
import type { SceneLabel } from './labels'
import { ease, progress } from './timeline'
import { useSequenceFrame } from './useSequence'

/** Gap between a side label and its point, and how far a label rises as it fades in. */
const SIDE_GAP_PX = 8
const RISE_PX = 8

const ALIGN: Record<SceneLabel['align'], string> = {
  center: 'translate(-50%, -50%)',
  left: `translate(calc(-100% - ${SIDE_GAP_PX}px), -50%)`,
  right: `translate(${SIDE_GAP_PX}px, -50%)`,
}

/** Moves each label element to its point on screen and fades it in on its step of the timeline. */
export function LabelProjector({
  labels,
  elements,
}: {
  labels: SceneLabel[]
  elements: RefObject<(HTMLDivElement | null)[]>
}) {
  const points = useMemo(() => labels.map((l) => new Vector3(...l.position)), [labels])
  const scratch = useMemo(() => new Vector3(), [])

  useSequenceFrame((t, { timeline }, { camera, size }) => {
    labels.forEach((label, i) => {
      const el = elements.current[i]
      if (!el) return
      const { appear } = label
      const span =
        appear.step === 'oldHouse' ? timeline.oldHouse : appear.step === 'fail' ? timeline.fail : timeline.labels[appear.index]
      const p = span ? ease.outCubic(progress(t, span)) : 0
      const ndc = scratch.copy(points[i]).project(camera)
      // Behind the camera, or not yet due.
      if (ndc.z > 1 || p <= 0) {
        el.style.opacity = '0'
        return
      }
      const x = ((ndc.x + 1) / 2) * size.width
      const y = ((1 - ndc.y) / 2) * size.height + (1 - p) * RISE_PX
      el.style.opacity = String(p)
      el.style.transform = `translate3d(${x}px, ${y}px, 0) ${ALIGN[label.align]}`
    })
  })

  return null
}
