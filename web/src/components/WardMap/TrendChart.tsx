import { useState, type CSSProperties } from 'react'
import type { TrendPoint, TrendResponse } from '@contracts/types'
import { formatNumber, labels } from '../../copy'

/**
 * Multiplex permits per month in a ward (MASTERSPEC 6.8), the same chart as the briefing page
 * (ai/page/briefing.js): one series, so no legend; the heading names it. Inline SVG, no chart library.
 * Bars use --suplex-permit-bar: the permit gold itself is too faint for bars (1.5:1 on white), and
 * #A27100 passes 3:1 on both the warm and the Lime + Teal surfaces.
 */

const P = labels.briefing_page
const W = 720
const H = 240
const M = { top: 34, right: 12, bottom: 26, left: 34 }
const INNER_W = W - M.left - M.right
const INNER_H = H - M.top - M.bottom
const BAR_MAX = 24 // px; a 2 px surface gap separates neighbouring bars
const RADIUS = 4 // rounded data end, square baseline

const monthFormat = new Intl.DateTimeFormat('en-CA', { month: 'short', year: 'numeric', timeZone: 'UTC' })
const monthName = (month: string) => monthFormat.format(new Date(`${month}-15T12:00:00Z`))

function tooltipText(point: TrendPoint): string {
  const template = point.permits === 1 ? P.trend_tooltip_one : P.trend_tooltip_other
  return template.replace('{month}', monthName(point.month)).replace('{count}', formatNumber(point.permits, true))
}

function barPath(x: number, top: number, width: number, height: number): string {
  const r = Math.min(RADIUS, height, width / 2)
  return (
    `M${x},${top + height}V${top + r}Q${x},${top} ${x + r},${top}H${x + width - r}` +
    `Q${x + width},${top} ${x + width},${top + r}V${top + height}Z`
  )
}

const axisText: CSSProperties = {
  fill: 'var(--suplex-ink-muted)',
  fontFamily: 'var(--font-ui)',
  fontSize: 11,
  fontVariantNumeric: 'tabular-nums',
}

const visuallyHidden: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

export function TrendChart({ trend }: { trend: TrendResponse }) {
  const [active, setActive] = useState<number | null>(null)
  const series = trend.series
  if (series.length === 0) return null

  const max = Math.max(1, ...series.map((p) => p.permits))
  const step = Math.max(1, Math.ceil(max / 4))
  const yMax = Math.ceil(max / step) * step
  const band = INNER_W / series.length
  const barW = Math.min(BAR_MAX, Math.max(1, band - 2))
  const y = (v: number) => M.top + INNER_H - (v / yMax) * INNER_H
  const ticks = Array.from({ length: yMax / step + 1 }, (_, i) => i * step)
  const caption = labels.ui.trend_caption
  const hovered = active === null ? null : series[active]

  return (
    <figure style={{ margin: 0, position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${P.trend_heading}. ${caption}`}
        style={{ display: 'block', width: '100%', height: 'auto', overflow: 'visible' }}
        onPointerLeave={() => setActive(null)}
      >
        {ticks.map((v) => (
          <g key={`tick-${v}`}>
            <line x1={M.left} x2={W - M.right} y1={y(v)} y2={y(v)} stroke="var(--suplex-line)" strokeWidth={1} />
            <text x={M.left - 6} y={y(v) + 4} textAnchor="end" style={axisText}>
              {formatNumber(v, true)}
            </text>
          </g>
        ))}

        {series.map((p, i) =>
          p.month.endsWith('-01') ? (
            <text key={`year-${p.month}`} x={M.left + i * band} y={H - 8} style={axisText}>
              {p.month.slice(0, 4)}
            </text>
          ) : null,
        )}

        {trend.markers.map((marker) => {
          const i = series.findIndex((p) => p.month === marker.month)
          if (i < 0) return null
          const mx = M.left + i * band + band / 2
          const nearEnd = i > series.length * 0.7
          return (
            <g key={`marker-${marker.month}`}>
              <line
                x1={mx}
                x2={mx}
                y1={M.top - 14}
                y2={M.top + INNER_H}
                stroke="var(--suplex-ink-muted)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text
                x={nearEnd ? mx - 4 : mx + 4}
                y={M.top - 18}
                textAnchor={nearEnd ? 'end' : 'start'}
                style={{ ...axisText, fill: 'var(--suplex-ink)' }}
              >
                {marker.label}
              </text>
            </g>
          )
        })}

        {series.map((p, i) => {
          const top = y(p.permits)
          const height = M.top + INNER_H - top
          const x = M.left + i * band + (band - barW) / 2
          return (
            <g key={p.month}>
              {p.permits > 0 && (
                <path
                  d={barPath(x, top, barW, height)}
                  fill="var(--suplex-permit-bar, #A27100)"
                  style={active === i ? { filter: 'brightness(0.75)' } : undefined}
                />
              )}
              {/* The hover target is the whole month's band, so empty months have a tooltip too. */}
              <rect
                x={M.left + i * band}
                y={M.top}
                width={band}
                height={INNER_H}
                fill="transparent"
                onPointerEnter={() => setActive(i)}
              />
            </g>
          )
        })}
      </svg>

      {hovered && active !== null && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: `${((M.left + active * band + band / 2) / W) * 100}%`,
            top: `${(y(hovered.permits) / H) * 100}%`,
            transform: 'translate(-50%, calc(-100% - 8px))',
            pointerEvents: 'none',
            padding: '4px 8px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--suplex-ink)',
            color: 'var(--suplex-surface)',
            fontSize: 'var(--text-xs)',
            whiteSpace: 'nowrap',
          }}
        >
          {tooltipText(hovered)}
        </div>
      )}

      <figcaption style={{ marginTop: 8, color: 'var(--suplex-ink-muted)', fontSize: 'var(--text-sm)' }}>
        {caption}{' '}
        {trend.source === 'cache' && (
          <span
            style={{
              display: 'inline-block',
              padding: '2px 8px',
              border: '1px solid var(--suplex-line)',
              borderRadius: 999,
              fontSize: 'var(--text-xs)',
              whiteSpace: 'nowrap',
            }}
          >
            {P.trend_source_cache}
          </span>
        )}
      </figcaption>

      <table style={visuallyHidden}>
        <caption>{P.trend_heading}</caption>
        <thead>
          <tr>
            <th scope="col">{P.trend_month}</th>
            <th scope="col">{P.trend_permits}</th>
          </tr>
        </thead>
        <tbody>
          {series.map((p) => (
            <tr key={p.month}>
              <td>{monthName(p.month)}</td>
              <td>{formatNumber(p.permits, true)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
