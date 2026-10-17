const POSTAL_CODE = /\b[a-z]\d[a-z][ -]?\d[a-z]\d\b/gi
const TRAILING_PLACE = /[\s,]+(toronto|ontario|on|canada)\.?$/i

/**
 * The street address alone. People paste "121 Front St E, Toronto, ON M5A 4P7", but the API
 * matches the start of the street address (MASTERSPEC 3.3), so the city, province, postal code
 * and country go.
 */
export function streetPart(query: string): string {
  let street = query.split(',')[0].replace(POSTAL_CODE, ' ').trim()
  while (TRAILING_PLACE.test(street)) street = street.replace(TRAILING_PLACE, '').trim()
  return street.replace(/\s+/g, ' ')
}
