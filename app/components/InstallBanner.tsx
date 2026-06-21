'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const DISMISSED_KEY = 'poolkeep_banner_dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallBanner() {
  const [show, setShow] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Already installed as standalone PWA
    const inStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true
    if (inStandalone) return

    // Permanently dismissed
    if (localStorage.getItem(DISMISSED_KEY)) return

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    setIsIos(ios)

    if (ios) {
      setShow(true)
      return
    }

    // Android/desktop: wait for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
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
    <div style={{
      margin: '12px 16px 0',
      borderRadius: 16,
      background: 'linear-gradient(135deg, #003D5C, #005580)',
      border: '1.5px solid rgba(0,204,163,0.35)',
      overflow: 'hidden',
    }}>
      {/* Teal accent top bar */}
      <div style={{ height: 3, background: 'linear-gradient(90deg, #0078B8, #00E0B0)' }} />

      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Icon */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icon-96.webp"
          alt="PoolKeep"
          style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, boxShadow: '0 3px 10px rgba(0,0,0,0.3)' }}
        />

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 13, marginBottom: 2 }}>
            Add PoolKeep to your home screen
          </p>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, lineHeight: 1.4 }}>
            {isIos
              ? 'Tap Share ↑ in Safari → "Add to Home Screen"'
              : 'One tap — works like a native app, no App Store needed'}
          </p>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          {isIos ? (
            <Link
              href="/install"
              style={{
                background: '#0078B8', color: '#fff',
                fontSize: 12, fontWeight: 700,
                padding: '7px 14px', borderRadius: 20,
                textDecoration: 'none', whiteSpace: 'nowrap',
              }}
            >
              Show me how
            </Link>
          ) : (
            <button
              onClick={install}
              style={{
                background: '#0078B8', color: '#fff',
                fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                padding: '7px 14px', borderRadius: 20, whiteSpace: 'nowrap',
              }}
            >
              Install App
            </button>
          )}
          <button
            onClick={dismiss}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.35)', fontSize: 11,
              textAlign: 'center', padding: '2px 0',
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
