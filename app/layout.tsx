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
      <head>
        {/* TEMPORARY — surfaces otherwise-silent blank-page failures (the
            Apple review + Android white-screen bug) directly on screen,
            since it runs before React itself has a chance to load. Remove
            once that bug is found and fixed. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                function show(label, detail) {
                  var el = document.getElementById('pk-boot-error');
                  if (!el) {
                    el = document.createElement('div');
                    el.id = 'pk-boot-error';
                    el.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#001a2e;color:#7CFC9A;font:11px/1.5 monospace;padding:16px;overflow:auto;white-space:pre-wrap;';
                    document.documentElement.appendChild(el);
                  }
                  el.textContent += '[' + label + '] ' + detail + '\\n\\n';
                }
                window.addEventListener('error', function (e) {
                  show('error', (e.message || 'unknown') + ' @ ' + (e.filename || '?') + ':' + (e.lineno || '?'));
                });
                window.addEventListener('unhandledrejection', function (e) {
                  var r = e.reason;
                  show('unhandledrejection', r && r.message ? r.message : String(r));
                });
                setTimeout(function () {
                  if (!document.getElementById('__next') && !document.querySelector('main')) {
                    show('timeout', 'No app content after 8s. location=' + location.href + ' UA=' + navigator.userAgent);
                  }
                }, 8000);
              })();
            `,
          }}
        />
      </head>
      <body>
        {children}
        <ServiceWorkerRegistration />
        <ForceRefreshOnResume />
        <InstallPrompt />
      </body>
    </html>
  )
}
