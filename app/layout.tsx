import type { Metadata, Viewport } from 'next'
import './globals.css'
import InstallPrompt from './components/InstallPrompt'
import ServiceWorkerRegistration from './components/ServiceWorkerRegistration'
import ForceRefreshOnResume from './components/ForceRefreshOnResume'
import DisableNativeZoom from './components/DisableNativeZoom'

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
                function showDebug(label, detail) {
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
                  showDebug('error', (e.message || 'unknown') + ' @ ' + (e.filename || '?') + ':' + (e.lineno || '?'));
                });
                window.addEventListener('unhandledrejection', function (e) {
                  var r = e.reason;
                  showDebug('unhandledrejection', r && r.message ? r.message : String(r));
                });

                // Real, permanent safety net: if nothing has rendered after 6s
                // (slow/stalled network, a hung request, anything), show an
                // actual retry screen instead of leaving the user staring at a
                // dead blank screen with no way forward.
                setTimeout(function () {
                  var hasContent = document.body && document.body.innerText && document.body.innerText.trim().length > 20;
                  if (hasContent) return;
                  showDebug('timeout', 'No visible text content after 6s. location=' + location.href + ' UA=' + navigator.userAgent);
                  var retry = document.createElement('div');
                  retry.style.cssText = 'position:fixed;inset:0;z-index:999998;background:#003D5C;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:32px;font-family:system-ui,-apple-system,sans-serif;';
                  retry.innerHTML =
                    '<p style="font-size:17px;font-weight:700;margin-bottom:8px;">Taking longer than expected</p>' +
                    '<p style="font-size:14px;color:rgba(255,255,255,0.7);margin-bottom:24px;max-width:280px;">This is taking a while to load. Check your connection and try again.</p>' +
                    '<button id="pk-retry-btn" style="background:#0078B8;color:#fff;font-weight:700;font-size:15px;padding:14px 28px;border:none;border-radius:12px;">Retry</button>';
                  document.documentElement.appendChild(retry);
                  document.getElementById('pk-retry-btn').addEventListener('click', function () {
                    location.reload();
                  });
                }, 6000);
              })();
            `,
          }}
        />
      </head>
      <body>
        {children}
        <ServiceWorkerRegistration />
        <ForceRefreshOnResume />
        <DisableNativeZoom />
        <InstallPrompt />
      </body>
    </html>
  )
}
