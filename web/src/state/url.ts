// URL state (MASTERSPEC 6.1): `?a=<address_id>` reopens an address check. Other parameters
// (`ward`, `design`, `view`, `demo`, `stats`) are left as they are.

export function addressFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('a')
}

export function setAddressInUrl(addressId: string | null): void {
  const url = new URL(window.location.href)
  if (url.searchParams.get('a') === addressId) return
  if (addressId) url.searchParams.set('a', addressId)
  else url.searchParams.delete('a')
  window.history.pushState(null, '', url)
}
