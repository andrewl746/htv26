import type { LotClass, Result } from '@contracts/types'
import { labels } from '../../copy'
import { bestDesign, resultProp, type DesignFilter } from './designs'
import type { LotProps } from './data'

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)

/**
 * What hovering a lot says (MASTERSPEC 6.5): the result and the design or the reason, such as
 * "May fit: Fourplex Narrow" or "Not checked: condo building". Never an address, never a parcel id.
 */
export function tooltipText(props: LotProps, filter: DesignFilter): string {
  const lotClass: LotClass = props.c
  if (lotClass === 'attached') return `${labels.results_map.no_fit}: ${lowerFirst(labels.classes.attached)}`
  if (lotClass !== 'checked') return `${labels.results_map.not_checked}: ${lowerFirst(labels.classes[lotClass])}`
  const result: Result = props[resultProp(filter)]
  const design = filter === 'all' ? (result === 'no_fit' ? null : bestDesign({ fn: props.rfn, fw: props.rfw, sn: props.rsn, sw: props.rsw })) : filter
  return `${labels.results_map[result]}: ${design ? labels.designs[design] : labels.ui.all_designs}`
}
