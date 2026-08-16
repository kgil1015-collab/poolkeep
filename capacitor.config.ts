import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.poolkeep.app',
  appName: 'PoolKeep',
  webDir: 'out',
  // Must be the exact URL that returns 200 directly, with zero redirects —
  // poolkeep.app (no www) 307-redirects to this, and the native WebView
  // fails silently (white screen, no JS ever executes) if it has to follow
  // that redirect on initial load. Verified via `curl -I` on 2026-08-16.
  server: {
    url: 'https://www.poolkeep.app',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
  },
  android: {
    allowMixedContent: false,
  },
}

export default config
