'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

// Pinch-to-zoom on the whole page is a deliberate accessibility feature for
// the web/PWA version (lets people zoom in on small text), but it reads as
// broken in the native App Store/Play Store app, where the rest of the UI
// chrome behaves like a normal native app. Only restrict it there.
export default function DisableNativeZoom() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const tag = document.querySelector('meta[name="viewport"]')
    if (tag) tag.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
  }, [])

  return null
}
