import type { ReactNode } from 'react'
import { labels } from '../../copy'
import { planCopy } from './copy'

// Every entry is a shape and a word; the colour only repeats them. The patterns are the legend's
// own, in swatch units, because the map's are in metres.
const HATCH = 5

function Swatch({ children }: { children: ReactNode }) {
  return (
    <svg className="plan-swatch" viewBox="0 0 24 16" width="24" height="16" aria-hidden="true">
      {children}
    </svg>
  )
}

export function Legend() {
  return (
    <section aria-label={planCopy.legend}>
      <h3 className="plan-heading">{planCopy.legend}</h3>
      <svg className="plan-defs" width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          <pattern id="legend-hatch-yard" width={HATCH} height={HATCH} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line className="plan-hatch-yard" x1={0} y1={0} x2={0} y2={HATCH} strokeWidth={1.25} />
          </pattern>
          <pattern id="legend-hatch-fail" width={HATCH} height={HATCH} patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <line className="plan-hatch-fail" x1={0} y1={0} x2={0} y2={HATCH} strokeWidth={2} />
          </pattern>
        </defs>
      </svg>
      <ul className="plan-legend">
        <li>
          <Swatch>
            <rect className="plan-lot" x={2} y={2} width={20} height={12} strokeWidth={2} />
          </Swatch>
          {planCopy.legend_lot}
        </li>
        <li>
          <Swatch>
            <rect x={2} y={2} width={20} height={12} className="plan-yard" style={{ fill: 'url(#legend-hatch-yard)' }} />
          </Swatch>
          {planCopy.legend_yards}
        </li>
        <li>
          <Swatch>
            <rect className="plan-buildable" x={2} y={2} width={20} height={12} strokeWidth={1.5} strokeDasharray="4 3" />
          </Swatch>
          {planCopy.legend_buildable}
        </li>
        <li>
          <Swatch>
            <rect className="plan-home" x={5} y={3} width={14} height={10} strokeWidth={1.5} />
          </Swatch>
          {planCopy.legend_footprint}
        </li>
        <li>
          <Swatch>
            <rect className="plan-fail" x={2} y={2} width={20} height={12} strokeWidth={1.5} style={{ fill: 'url(#legend-hatch-fail)' }} />
            <text className="plan-fail-mark" x={12} y={8} fontSize={12} strokeWidth={2} textAnchor="middle" dominantBaseline="central">
              ✕
            </text>
          </Swatch>
          {planCopy.legend_outside}
        </li>
        <li>
          <Swatch>
            <rect className="plan-existing" x={4} y={3} width={16} height={10} strokeWidth={1.25} strokeDasharray="4 3" />
          </Swatch>
          {planCopy.legend_existing}
        </li>
        <li>
          <Swatch>
            <rect className="plan-building plan-building-house" x={4} y={3} width={16} height={10} strokeWidth={1.25} />
          </Swatch>
          {planCopy.legend_neighbours}
        </li>
        <li>
          <Swatch>
            <path className="plan-permit" d="M12,2L19,8L12,14L5,8Z" strokeWidth={1.25} />
          </Swatch>
          {labels.ui.legend_permit}
        </li>
        <li>
          <Swatch>
            <g className="plan-pin" strokeWidth={2}>
              <circle cx={12} cy={8} r={6} />
              <circle className="plan-pin-dot" cx={12} cy={8} r={2} />
            </g>
          </Swatch>
          {planCopy.legend_you}
        </li>
      </ul>
    </section>
  )
}
