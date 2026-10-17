import type { RefObject } from 'react'
import type { SceneLabel } from './labels'

/** The label elements, laid over the canvas. LabelProjector positions and fades them. */
export function SceneLabels({
  labels,
  elements,
}: {
  labels: SceneLabel[]
  elements: RefObject<(HTMLDivElement | null)[]>
}) {
  return (
    <div className="scene-labels">
      {labels.map((label, i) => (
        <div
          key={label.key}
          ref={(el) => {
            elements.current[i] = el
          }}
          className={label.muted ? 'scene-label scene-label-muted' : 'scene-label'}
          style={{ opacity: 0 }}
        >
          {label.swatch && <span className="home-swatch" style={{ background: label.swatch }} />}
          {label.text}
        </div>
      ))}
    </div>
  )
}
