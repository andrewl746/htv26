import { API_BASE } from './api/config'

/**
 * The "Try:" chips on the landing page (MASTERSPEC 6.2): one lot that fits and one that does not
 * clearly fit. Until S9 picks the backup addresses in /pitch/demo.md, the live API uses two of the
 * Ward 04 lots Andrew hand-checked (docs/test-lots.md), and the fixtures use their own addresses
 * (a fixture id is a 404 on the real API, and a real one is missing from the fixtures).
 */
const LIVE = [
  { address_id: '7986858', address_full: '326 Quebec Ave' }, // all four designs fit
  { address_id: '7955411', address_full: '281 Armadale Ave' }, // Fourplex Narrow too close to call
]

const FIXTURES = [
  { address_id: 'fixture-2', address_full: '200 Fixture St' },
  { address_id: 'fixture-1', address_full: '100 Fixture St' },
]

export const EXAMPLES = API_BASE === null ? FIXTURES : LIVE
