// URL state (MASTERSPEC 6.1): `?a=<address_id>` reopens an address check. Other parameters
// (`ward`, `design`, `demo`, `stats`) are left as they are. `view=plan` opens the plan view.

export function addressFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('a')
}

export function setAddressInUrl(addressId: string | null): void {
  const url = new URL(window.location.href)
  if (url.searchParams.get('a') === addressId) return
  if (addressId) url.searchParams.set('a', addressId)
  else url.searchParams.delete('a')
  // A different address opens in the 3D lot, not in the plan view the last one was left in.
  url.searchParams.delete('view')
  window.history.pushState(null, '', url)
}

export function planFromUrl(): boolean {
  return new URLSearchParams(window.location.search).get('view') === 'plan'
}

export function setViewInUrl(view: 'plan' | null): void {
  const url = new URL(window.location.href)
  if (url.searchParams.get('view') === view) return
  if (view) url.searchParams.set('view', view)
  else url.searchParams.delete('view')
  window.history.pushState(null, '', url)
}
