import type { CheckResponse } from '@contracts/types'
import checkFitsJson from '@contracts/fixtures/check.fits.json'

// Fixtures stand in for the API until J8 switches the base URL (MASTERSPEC 6, 8.3).
// The JSON import infers plain strings and number[] where the contract has unions and tuples.
export const checkFits = checkFitsJson as unknown as CheckResponse
