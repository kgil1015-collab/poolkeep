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
    const inStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true
    if (inStandalone) return

    if (localStorage.getItem(DISMISSED_KEY)) return

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    setIsIos(ios)

    if (ios) {
      setShow(true)
      return
    }

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
      borderRadius: 18,
      background: '#003D5C',
      overflow: 'hidden',
    }}>
      {/* Gradient top bar */}
      <div style={{ height: 4, background: 'linear-gradient(90deg, #0078B8, #00CCA3)' }} />

      <div style={{ padding: '16px 16px 14px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-96.webp"
            alt="PoolKeep"
            style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, boxShadow: '0 3px 10px rgba(0,0,0,0.35)' }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: '#fff', fontWeight: 800, fontSize: 15, marginBottom: 2, letterSpacing: '-.01em' }}>
              Add PoolKeep to your Home Screen
            </p>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, lineHeight: 1.4 }}>
              Works like a real app — no App Store needed
            </p>
          </div>
        </div>

        {isIos ? (
          <>
            {/* iOS inline steps */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {[
                { n: '1', icon: '↑', label: 'Tap Share', sub: 'bottom of Safari' },
                { n: '2', icon: '+', label: 'Add to Home Screen', sub: 'scroll down to find it' },
                { n: '3', icon: '✓', label: 'Tap Add', sub: 'top right corner' },
              ].map(step => (
                <div key={step.n} style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  padding: '10px 8px',
                  textAlign: 'center',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: '#0078B8',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 6px',
                    fontSize: 16, fontWeight: 800, color: '#fff',
                  }}>{step.icon}</div>
                  <p style={{ color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1.3, marginBottom: 2 }}>{step.label}</p>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, lineHeight: 1.3 }}>{step.sub}</p>
                </div>
              ))}
            </div>
            <Link
              href="/install"
              style={{
                display: 'block', width: '100%', textAlign: 'center',
                background: '#0078B8', color: '#fff',
                fontSize: 14, fontWeight: 700,
                padding: '12px 0', borderRadius: 12,
                textDecoration: 'none',
              }}
            >
              See step-by-step guide →
            </Link>
          </>
        ) : (
          <button
            onClick={install}
            style={{
              display: 'block', width: '100%',
              background: '#0078B8', color: '#fff',
              fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
              padding: '13px 0', borderRadius: 12,
            }}
          >
            Add to Home Screen →
          </button>
        )}

        <button
          onClick={dismiss}
          style={{
            display: 'block', width: '100%',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.3)', fontSize: 11,
            textAlign: 'center', padding: '10px 0 0',
          }}
        >
          Not now
        </button>
      </div>
    </div>
  )
}
