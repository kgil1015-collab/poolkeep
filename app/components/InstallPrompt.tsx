'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'poolkeep_install_dismissed'
const DISMISS_DAYS = 14

const PUBLIC_PATHS = ['/', '/signup', '/login', '/privacy', '/terms']

export default function InstallPrompt() {
  const pathname = usePathname()
  const [show, setShow] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (PUBLIC_PATHS.includes(pathname)) return
    // Don't show if already installed (standalone mode)
    const inStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true
    if (inStandalone) return

    // Don't show if dismissed recently
    const dismissed = localStorage.getItem(DISMISSED_KEY)
    if (dismissed) {
      const daysAgo = (Date.now() - Number(dismissed)) / 86400000
      if (daysAgo < DISMISS_DAYS) return
    }

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    setIsIos(ios)

    if (ios) {
      // iOS doesn't fire beforeinstallprompt — show manual instructions after delay
      const t = setTimeout(() => setShow(true), 3000)
      return () => clearTimeout(t)
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setTimeout(() => setShow(true), 3000)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    setShow(false)
  }

  async function install() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShow(false)
    } else {
      dismiss()
    }
    setDeferredPrompt(null)
  }

  if (!show) return null

  return (
    <div
      className="fixed bottom-20 left-0 right-0 z-50 px-4"
      style={{maxWidth: 480, margin: '0 auto', left: '50%', transform: 'translateX(-50%)', width: '100%'}}
    >
      <div
        className="rounded-2xl shadow-2xl p-4 flex items-start gap-3"
        style={{background: '#003D5C', border: '1px solid rgba(255,255,255,0.12)'}}
      >
        {/* Icon */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="PoolKeep" width={44} height={44} className="rounded-xl shrink-0" style={{background:'white'}} />

        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm leading-tight">Add PoolKeep to your home screen</p>
          {isIos ? (
            <p className="text-white/65 text-xs mt-1 leading-snug">
              Tap <span className="text-white font-semibold">Share</span> then <span className="text-white font-semibold">Add to Home Screen</span> for the full app experience.
            </p>
          ) : (
            <p className="text-white/65 text-xs mt-1 leading-snug">
              Install for offline access and a faster, app-like experience.
            </p>
          )}
          {!isIos && (
            <button
              onClick={install}
              className="mt-2.5 text-xs font-bold px-4 py-1.5 rounded-xl"
              style={{background: '#00E0B0', color: '#003D5C'}}
            >
              Install App
            </button>
          )}
        </div>

        {/* Dismiss */}
        <button onClick={dismiss} className="text-white/40 hover:text-white/80 transition-colors shrink-0 mt-0.5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
