import { fill } from '../../../copy'
import { mxCopy } from './copy'
import type { MultiplexProps } from './types'

/** What clicking a permit dot shows: the street name only, never an address number. */
export interface PopupContent {
  heading: string
  rows: { label: string; value: string }[]
  note: string
}

const WORK_LABEL = {
  new_build: mxCopy.popup.work_new_build,
  conversion: mxCopy.popup.work_conversion,
}

const STATUS_LABEL = {
  cleared: mxCopy.popup.status_cleared,
  active: mxCopy.popup.status_active,
}

/** The year of an ISO date, or the date as given when it does not parse. */
function issuedYear(issued: string): string {
  const match = /^(\d{4})-/.exec(issued)
  return match ? match[1] : issued
}

export function popupContent(p: MultiplexProps): PopupContent {
  return {
    heading: fill(mxCopy.popup.heading, { street: p.street }),
    rows: [
      { label: mxCopy.popup.units, value: String(p.units) },
      { label: mxCopy.popup.type, value: WORK_LABEL[p.work] },
      { label: mxCopy.popup.structure, value: mxCopy.structure[p.structure] },
      { label: mxCopy.popup.status, value: STATUS_LABEL[p.status] },
      { label: mxCopy.popup.issued, value: issuedYear(p.issued) },
    ],
    note: mxCopy.popup.note,
  }
}
