import type { RefObject } from 'react'
import { ResultIcon } from '../ResultPanel/ResultIcon'
import type { SceneLabel } from './labels'
import './sceneLabels.css'

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
          className={[
            'scene-label',
            label.muted ? 'scene-label-muted' : '',
            label.icon ? `scene-label-result scene-label-${label.icon}` : '',
          ].join(' ')}
          style={{ opacity: 0 }}
        >
          {label.icon && <ResultIcon result={label.icon} />}
          {label.detail ? (
            <span className="scene-label-lines">
              <span>{label.text}</span>
              <span className="scene-label-detail">{label.detail}</span>
            </span>
          ) : (
            label.text
          )}
        </div>
      ))}
    </div>
  )
}
