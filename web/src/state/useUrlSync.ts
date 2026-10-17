import { useEffect } from 'react'
import { useApp } from './store'
import { addressFromUrl, planFromUrl } from './url'

/** Opens whatever the URL names on load, and again on back and forward. */
export function useUrlSync(): void {
  const openAddress = useApp((s) => s.openAddress)
  const showLanding = useApp((s) => s.showLanding)
  const showPlan = useApp((s) => s.showPlan)

  useEffect(() => {
    const sync = () => {
      const addressId = addressFromUrl()
      if (addressId) {
        openAddress(addressId, { updateUrl: false })
        if (planFromUrl()) showPlan({ updateUrl: false })
      } else showLanding({ updateUrl: false })
    }
    sync()
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [openAddress, showLanding, showPlan])
}
