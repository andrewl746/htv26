import type { Design, DesignResult, LocalPoint, RuleId, RuleRow } from '@contracts/types'
import engineConfig from '@contracts/engine_config.json'
import { openRing, signedArea } from './geometry'
import { placementFrame, pointOn, type PlacementFrame } from './floors'

// J8 (MASTERSPEC 2.4, 6.3): a design that does not fit shows where it fails. The parts of its
// footprint that cross into the required yards (the engine's fail_slices_local) stand as a
// translucent red slab the height of the building, labelled with the rule and its numbers. A result
// that is too close to call gets the same slab in the borderline stripes instead of red.
//
// Some rules are not about the footprint's edges, and a too-close-to-call footprint can sit just
// inside its yards, so the engine returns no slice. Then the slab comes from the rule itself: the
// side strips for lot width, the rear for lot depth or building length, the part above the height
// limit for height, and the whole building for coverage, homes allowed or a detached lot. The
// engine's slices are drawn only when the rule the label names is about the edges (lot width or
// depth), so the slab always shows the rule its label names.

export type SlabKind = 'no_fit' | 'borderline'

export interface FailSlab {
  kind: SlabKind
  /** The rule the label names; null when the result carries no rule to name. */
  rule: RuleRow | null
  /** Footprint pieces, local metres, counter-clockwise. */
  polygons: LocalPoint[][]
  /** Metres above grade. */
  bottom: number
  top: number
}

/** Rules whose failure is a footprint crossing a yard: the engine's slices are theirs. */
const EDGE_RULES: RuleId[] = ['lot_width', 'lot_depth']
/** The thinnest strip worth drawing, so a tiny margin still shows. */
const MIN_STRIP_M = 0.15
const BAND_M = engineConfig.uncertainty_band_m

export function failSlab(result: DesignResult, design: Design): FailSlab | null {
  if (result.result !== 'no_fit' && result.result !== 'borderline') return null
  const placement = result.placement_local
  if (!placement) return null
  const kind = result.result
  const slices = result.fail_slices_local.map(openRing).filter((ring) => ring.length >= 3)
  const rule = kind === 'no_fit' ? failingRule(result, slices.length > 0) : borderlineRule(result, slices.length > 0)
  const top = design.height_m
  if (slices.length && rule && EDGE_RULES.includes(rule.rule_id)) {
    return { kind, rule, polygons: slices.map(counterClockwise), bottom: 0, top }
  }
  return { kind, rule, ...fromRule(rule, placementFrame(placement), kind, top) }
}

/** The clear failure to name: an edge rule when there are slices, else the blocking rule. */
function failingRule(result: DesignResult, hasSlices: boolean): RuleRow | null {
  const failing = result.rules.filter((r) => r.pass === false)
  const pick = (rows: RuleRow[]) =>
    (hasSlices ? rows.find((r) => EDGE_RULES.includes(r.rule_id)) : undefined) ??
    rows.find((r) => r.rule_id === result.blocking_rule) ??
    rows[0]
  return pick(failing.filter((r) => !r.borderline)) ?? pick(failing) ?? null
}

function borderlineRule(result: DesignResult, hasSlices: boolean): RuleRow | null {
  const close = result.rules.filter((r) => r.borderline)
  return (hasSlices ? close.find((r) => EDGE_RULES.includes(r.rule_id)) : undefined) ?? close[0] ?? null
}

function fromRule(
  rule: RuleRow | null,
  frame: PlacementFrame,
  kind: SlabKind,
  top: number,
): Pick<FailSlab, 'polygons' | 'bottom' | 'top'> {
  const whole = [rect(frame, 0, 1, 0, frame.length)]
  // How much is at stake: the band when too close to call, the shortfall when it fails.
  const shortfall = (fallback: number) =>
    kind === 'borderline' ? BAND_M : typeof rule?.margin === 'number' ? Math.abs(rule.margin) : fallback
  switch (rule?.rule_id) {
    case 'lot_width': {
      // Shared between the two side yards.
      const strip = Math.min(Math.max(shortfall(BAND_M) / 2, MIN_STRIP_M), frame.width / 2) / frame.width
      return { polygons: [rect(frame, 0, strip, 0, frame.length), rect(frame, 1 - strip, 1, 0, frame.length)], bottom: 0, top }
    }
    case 'lot_depth':
    case 'building_length': {
      const strip = Math.min(Math.max(shortfall(BAND_M), MIN_STRIP_M), frame.length)
      return { polygons: [rect(frame, 0, 1, frame.length - strip, frame.length)], bottom: 0, top }
    }
    case 'height': {
      const over = Math.min(Math.max(shortfall(BAND_M), MIN_STRIP_M), top)
      return { polygons: whole, bottom: top - over, top }
    }
    default:
      return { polygons: whole, bottom: 0, top }
  }
}

/** A rectangle on the footprint: shares of the width from the left wall, metres back from the front. */
function rect(frame: PlacementFrame, from: number, to: number, back0: number, back1: number): LocalPoint[] {
  return counterClockwise([
    pointOn(frame, from, back0),
    pointOn(frame, to, back0),
    pointOn(frame, to, back1),
    pointOn(frame, from, back1),
  ])
}

function counterClockwise(ring: LocalPoint[]): LocalPoint[] {
  return signedArea(ring) < 0 ? [...ring].reverse() : ring
}

/** Where the label hangs: over the middle of all the pieces, so two side strips share one label. */
export function slabAnchor(slab: FailSlab): LocalPoint {
  const points = slab.polygons.flat()
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
}
