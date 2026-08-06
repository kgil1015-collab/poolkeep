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
                // Non-destructive: pinned to the bottom of the screen so it never
                // hides real content, in case content actually did render fine.
                function show(label, detail) {
                  var el = document.getElementById('pk-boot-error');
                  if (!el) {
                    el = document.createElement('div');
                    el.id = 'pk-boot-error';
                    el.style.cssText = 'position:fixed;left:0;right:0;bottom:0;max-height:40vh;z-index:999999;background:rgba(0,26,46,0.95);color:#7CFC9A;font:11px/1.5 monospace;padding:12px;overflow:auto;white-space:pre-wrap;border-top:2px solid #7CFC9A;';
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
                  var hasContent = document.body && document.body.innerText && document.body.innerText.trim().length > 20;
                  if (!hasContent) {
                    show('timeout', 'No visible text content after 8s. location=' + location.href + ' UA=' + navigator.userAgent);
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
