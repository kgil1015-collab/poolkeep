import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.poolkeep.app',
  appName: 'PoolKeep',
  webDir: 'out',
  server: {
    url: 'https://poolkeep.app',
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
