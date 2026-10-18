import type { DesignId } from '@contracts/types'
import { fourplexNarrow } from './fourplexNarrow'
import { fourplexWide } from './fourplexWide'
import { sixplexNarrow } from './sixplexNarrow'
import { sixplexWide } from './sixplexWide'
import type { FacadeModel } from './types'

/** The designs modelled from their elevation sheets (A16); a design without one draws as classic floors. */
export const FACADES: Partial<Record<DesignId, FacadeModel>> = {
  fourplex_narrow: fourplexNarrow,
  fourplex_wide: fourplexWide,
  sixplex_narrow: sixplexNarrow,
  sixplex_wide: sixplexWide,
}
