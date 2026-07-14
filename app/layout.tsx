import type { Metadata, Viewport } from 'next'
import './globals.css'
import InstallPrompt from './components/InstallPrompt'
import ServiceWorkerRegistration from './components/ServiceWorkerRegistration'
import ForceRefreshOnResume from './components/ForceRefreshOnResume'

export const metadata: Metadata = {
  title: 'PoolKeep — Smart Pool Maintenance',
  description: 'Test your water. Get exact chemical doses. Log everything. Share with a pro in one tap.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PoolKeep',
  },
  icons: {
    apple: '/icon-1024.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#003D5C',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ServiceWorkerRegistration />
        <ForceRefreshOnResume />
        <InstallPrompt />
      </body>
    </html>
  )
}
