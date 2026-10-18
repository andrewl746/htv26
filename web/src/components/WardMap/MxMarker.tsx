const MARK_BOX = 22
const MARK_CENTRE = MARK_BOX / 2

/** The two permit markers and the cluster bubble, drawn the way the map draws them. */
export function MxMarker({ kind }: { kind: 'cleared' | 'active' | 'cluster' }) {
  const r = kind === 'cluster' ? 9.5 : 6
  return (
    <svg className="mx-mark" width={MARK_BOX} height={MARK_BOX} viewBox={`0 0 ${MARK_BOX} ${MARK_BOX}`} aria-hidden="true" focusable="false">
      <circle cx={MARK_CENTRE} cy={MARK_CENTRE} r={r} className="mx-mark-fill" />
      <circle cx={MARK_CENTRE} cy={MARK_CENTRE} r={r} className="mx-mark-edge" />
      {kind === 'active' && <circle cx={MARK_CENTRE} cy={MARK_CENTRE} r={2.6} className="mx-mark-hole" />}
      {kind === 'cluster' && (
        <text x={MARK_CENTRE} y={MARK_CENTRE} className="mx-mark-text" textAnchor="middle" dominantBaseline="central">
          12
        </text>
      )}
    </svg>
  )
}
