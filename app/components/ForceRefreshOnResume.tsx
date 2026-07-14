'use client'

import { useEffect } from 'react'

// iOS's JS engine resolves the device's timezone once per process and doesn't
// re-read it if the system timezone changes while the app is still running in
// the background (e.g. flying somewhere and the phone auto-updates) — every
// "Last tested at ..." time then keeps rendering under the stale timezone
// until the app gets a fresh process. Reloading after a real gap in the
// background forces that fresh read without disrupting normal quick app
// switches (checking a notification, etc).
const STALE_AFTER_MS = 5 * 60 * 1000

export default function ForceRefreshOnResume() {
  useEffect(() => {
    let hiddenAt: number | null = null

    function handleVisibilityChange() {
      if (document.hidden) {
        hiddenAt = Date.now()
        return
      }
      if (hiddenAt !== null && Date.now() - hiddenAt > STALE_AFTER_MS) {
        window.location.reload()
      }
      hiddenAt = null
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  return null
}
