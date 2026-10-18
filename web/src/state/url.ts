// URL state (MASTERSPEC 6.1): `?a=<address_id>` reopens an address check, `?lot=<lot_id>` a lot
// opened from the ward map that has no address, `view=plan` the plan view and `ward=04` the ward
// view. Other parameters (`design`, `demo`, `stats`) are left as they are.

function params(): URLSearchParams {
  return new URLSearchParams(window.location.search)
}

function push(update: (search: URLSearchParams) => void): void {
  const url = new URL(window.location.href)
  const before = url.search
  update(url.searchParams)
  if (url.search !== before) window.history.pushState(null, '', url)
}

export function addressFromUrl(): string | null {
  return params().get('a')
}

export function lotFromUrl(): string | null {
  return params().get('lot')
}

export function setAddressInUrl(addressId: string | null): void {
  push((search) => {
    if (search.get('a') === addressId && !search.has('lot')) return
    if (addressId) search.set('a', addressId)
    else search.delete('a')
    search.delete('lot')
    // A different address opens in the 3D lot, not in the plan or ward view the last one was left in.
    search.delete('view')
    search.delete('ward')
  })
}

export function setLotInUrl(lotId: string): void {
  push((search) => {
    search.delete('a')
    search.set('lot', lotId)
    search.delete('view')
    search.delete('ward')
  })
}

export function planFromUrl(): boolean {
  return params().get('view') === 'plan'
}

export function setViewInUrl(view: 'plan' | null): void {
  push((search) => {
    if (view) search.set('view', view)
    else search.delete('view')
    search.delete('ward')
  })
}

export function wardFromUrl(): string | null {
  const ward = params().get('ward')
  return ward && /^\d{2}$/.test(ward) ? ward : null
}

export function setWardInUrl(wardId: string | null): void {
  push((search) => {
    if (wardId) search.set('ward', wardId)
    else search.delete('ward')
    search.delete('view')
  })
}
