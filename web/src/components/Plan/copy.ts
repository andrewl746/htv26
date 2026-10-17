import { labels } from '../../copy'

/**
 * Strings the plan view needs that contracts/copy does not have yet. Simone owns contracts/copy
 * and needs to add them under `plan` in labels.json; delete each entry here once it lands there.
 */
const pending = {
  zoom_street: 'Street',
  zoom_in: 'Zoom in',
  zoom_out: 'Zoom out',
  // The map's licence credit; keep the wording.
  attribution: '© OpenStreetMap contributors · OpenFreeMap · OpenMapTiles',
}

/** Everything else on the plan view (disclaimers, the permit line, the legend's permit entry, the 3D switch) is in contracts/copy too. */
export const planCopy = { ...labels.plan, ...pending }
