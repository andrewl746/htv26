import { useEffect } from 'react'
import { useApp } from './store'
import { addressFromUrl, lotFromUrl, planFromUrl, wardFromUrl } from './url'

/** Opens whatever the URL names on load, and again on back and forward. */
export function useUrlSync(): void {
  const openAddress = useApp((s) => s.openAddress)
  const openLot = useApp((s) => s.openLot)
  const showLanding = useApp((s) => s.showLanding)
  const showPlan = useApp((s) => s.showPlan)
  const showWard = useApp((s) => s.showWard)

  useEffect(() => {
    const sync = () => {
      const addressId = addressFromUrl()
      const lotId = lotFromUrl()
      const wardId = wardFromUrl()
      if (addressId) openAddress(addressId, { updateUrl: false })
      else if (lotId) openLot(lotId, { updateUrl: false })
      else if (!wardId) {
        showLanding({ updateUrl: false })
        return
      }
      if (wardId) showWard({ updateUrl: false, wardId })
      else if (planFromUrl()) showPlan({ updateUrl: false })
    }
    sync()
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [openAddress, openLot, showLanding, showPlan, showWard])
}
