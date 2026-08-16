'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Capacitor } from '@capacitor/core'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'poolkeep_install_dismissed'
const DISMISS_DAYS  = 14
const PUBLIC_PATHS  = ['/', '/signup', '/login', '/privacy', '/terms']

export default function InstallPrompt() {
  const pathname = usePathname()
  const [show, setShow]                     = useState(false)
  const [isIos, setIsIos]                   = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (PUBLIC_PATHS.includes(pathname)) return

    // Already the real native app — nothing to install
    if (Capacitor.isNativePlatform()) return

    // Already installed as standalone PWA
    const inStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true
    if (inStandalone) return

    // Dismissed recently
    const dismissed = localStorage.getItem(DISMISSED_KEY)
    if (dismissed && (Date.now() - Number(dismissed)) / 86400000 < DISMISS_DAYS) return

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    setIsIos(ios)

    if (ios) {
      const t = setTimeout(() => setShow(true), 2500)
      return () => clearTimeout(t)
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setTimeout(() => setShow(true), 2500)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [pathname])

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    setShow(false)
  }

  async function install() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    if (outcome === 'accepted') setShow(false)
    else dismiss()
  }

  if (!show) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={dismiss}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,20,40,0.5)',
          zIndex: 9998, animation: 'pkFadeIn 0.25s ease both',
        }}
      />

      {/* Bottom sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        maxWidth: 480, margin: '0 auto',
        background: '#003D5C',
        borderRadius: '22px 22px 0 0',
        zIndex: 9999,
        animation: 'pkSlideUp 0.38s cubic-bezier(0.34,1.45,0.64,1) both',
        boxShadow: '0 -8px 48px rgba(0,0,0,0.4)',
        overflow: 'hidden',
      }}>
        {/* Teal accent bar */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, #0078B8, #00E0B0, #0078B8)' }} />

        <div style={{ padding: '20px 20px 36px' }}>

          {/* App identity row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/icon-96.webp" alt="PoolKeep" style={{
                width: 52, height: 52, borderRadius: 14,
                boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
              }} />
              <div>
                <p style={{
                  color: '#fff', fontWeight: 700, fontSize: 17, lineHeight: 1.15,
                  fontFamily: "'Space Grotesk', sans-serif",
                }}>
                  Pool<span style={{ fontWeight: 800 }}>Keep</span>
                </p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 3 }}>
                  Smart pool maintenance
                </p>
              </div>
            </div>
            <button onClick={dismiss} style={{
              background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%',
              width: 32, height: 32, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,0.5)',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 14, lineHeight: 1.6, marginBottom: 18 }}>
            Add PoolKeep to your home screen for instant access — it works just like a native app, no App Store required.
          </p>

          {isIos ? (
            <>
              {/* iOS step-by-step */}
              <div style={{
                background: 'rgba(0,120,184,0.18)', borderRadius: 14, padding: '14px 16px',
                border: '1px solid rgba(0,168,240,0.18)', marginBottom: 16,
              }}>
                <IOSStep n={1}>
                  Tap the{' '}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00A8F0"
                    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ display: 'inline', verticalAlign: 'middle', margin: '0 2px -1px' }}>
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                    <polyline points="16 6 12 2 8 6"/>
                    <line x1="12" y1="2" x2="12" y2="15"/>
                  </svg>{' '}
                  <strong style={{ color: '#fff' }}>Share</strong> button at the bottom of Safari
                </IOSStep>
                <IOSStep n={2}>
                  Scroll down and tap{' '}
                  <strong style={{ color: '#fff' }}>&ldquo;Add to Home Screen&rdquo;</strong>
                </IOSStep>
                <IOSStep n={3} last>
                  Tap <strong style={{ color: '#fff' }}>&ldquo;Add&rdquo;</strong> — you&rsquo;re all set!
                </IOSStep>
              </div>
              <button onClick={dismiss} style={{
                width: '100%', padding: '15px', borderRadius: 13,
                background: '#0078B8', color: '#fff',
                fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer',
                boxShadow: '0 5px 18px rgba(0,120,184,0.45)',
              }}>
                Got it ✓
              </button>
            </>
          ) : (
            <>
              <button onClick={install} style={{
                width: '100%', padding: '16px', borderRadius: 13,
                background: 'linear-gradient(135deg, #0078B8, #00A8F0)',
                color: '#fff', fontWeight: 700, fontSize: 15,
                border: 'none', cursor: 'pointer',
                boxShadow: '0 6px 22px rgba(0,120,184,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Install App
              </button>
              <button onClick={dismiss} style={{
                width: '100%', padding: '12px', marginTop: 8,
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,0.35)', fontSize: 13,
              }}>
                Not now
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pkFadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes pkSlideUp { from { transform: translateY(110%) } to { transform: translateY(0) } }
      `}</style>
    </>
  )
}

function IOSStep({ n, children, last = false }: { n: number; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: last ? 0 : 10 }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        background: '#0078B8', color: '#fff',
        fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {n}
      </div>
      <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: 13, lineHeight: 1.45 }}>
        {children}
      </p>
    </div>
  )
}
