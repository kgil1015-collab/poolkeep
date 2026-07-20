'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [linkError, setLinkError] = useState('')
  const readyRef = useRef(false)

  // Supabase delivers the session via URL hash fragment on this page
  useEffect(() => {
    // Expired/invalid reset links redirect back with an error in the hash
    // (e.g. #error=access_denied&error_code=otp_expired&...) instead of
    // firing PASSWORD_RECOVERY — check for that first.
    if (typeof window !== 'undefined') {
      const hashParams = new URLSearchParams(window.location.hash.slice(1))
      const description = hashParams.get('error_description')
      if (description) {
        setLinkError(description.replace(/\+/g, ' '))
        return
      }
    }

    const supabase = createClient()
    // Listen for the PASSWORD_RECOVERY event which fires when the reset link is valid
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') { readyRef.current = true; setReady(true) }
    })
    // Also check if already in a recovery session
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { readyRef.current = true; setReady(true) }
    })
    // Neither the event nor an existing session showed up — treat it as an
    // expired link instead of spinning forever.
    const timeout = setTimeout(() => {
      if (!readyRef.current) setLinkError('This reset link has expired or is no longer valid.')
    }, 8000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!password) { setError('Please enter a new password.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }

    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) { setError(updateError.message); return }
    router.push('/dashboard')
  }

  if (linkError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{background:'linear-gradient(172deg,#e8f5ff 0%,#c4dff5 38%,#9ac4e8 70%,#6ba8d8 100%)'}}>
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{background:'rgba(229,48,74,0.1)'}}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#E5304A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">Link expired</h1>
          <p className="text-text-muted text-sm mb-6 leading-relaxed">{linkError}</p>
          <Link href="/forgot-password" className="inline-block w-full bg-pool-dark text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity text-sm">
            Request a New Link →
          </Link>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{background:'linear-gradient(172deg,#e8f5ff 0%,#c4dff5 38%,#9ac4e8 70%,#6ba8d8 100%)'}}>
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 text-center">
          <div className="w-10 h-10 rounded-full border-4 border-pool-dark/20 border-t-pool-dark animate-spin mx-auto mb-4" />
          <p className="text-text-muted text-sm">Verifying reset link…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{background:'linear-gradient(172deg,#e8f5ff 0%,#c4dff5 38%,#9ac4e8 70%,#6ba8d8 100%)'}}>
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8">
        <div className="flex items-center justify-center gap-2 mb-6">
          <svg viewBox="28 8 144 175" width="28" height="34" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="rd" x1=".35" y1="0" x2=".65" y2="1"><stop offset="0%" stopColor="#92D5F5"/><stop offset="42%" stopColor="#3A8AC8"/><stop offset="100%" stopColor="#052C4E"/></linearGradient>
              <radialGradient id="rg" cx="42%" cy="25%" r="40%"><stop offset="0%" stopColor="#fff" stopOpacity=".5"/><stop offset="100%" stopColor="#fff" stopOpacity="0"/></radialGradient>
              <clipPath id="rc"><path d="M100 8C100 8 28 88 28 124C28 163 61 183 100 183C139 183 172 163 172 124C172 88 100 8 100 8Z"/></clipPath>
            </defs>
            <path d="M100 8C100 8 28 88 28 124C28 163 61 183 100 183C139 183 172 163 172 124C172 88 100 8 100 8Z" fill="url(#rd)"/>
            <path d="M100 8C100 8 28 88 28 124C28 163 61 183 100 183C139 183 172 163 172 124C172 88 100 8 100 8Z" fill="url(#rg)"/>
            <g clipPath="url(#rc)" fill="none" stroke="white" strokeLinecap="round">
              <path d="M46 145Q100 122 154 145" strokeWidth="4.5" opacity=".82"/>
              <path d="M38 160Q100 136 162 160" strokeWidth="4" opacity=".62"/>
              <path d="M50 173Q100 152 150 173" strokeWidth="3.5" opacity=".42"/>
            </g>
          </svg>
          <span className="text-pool-deep text-2xl tracking-tight" style={{fontFamily:"'Space Grotesk',sans-serif"}}>
            <span style={{fontWeight:300}}>Pool</span><span style={{fontWeight:800}}>Keep</span>
          </span>
        </div>

        <h1 className="text-2xl font-bold text-text-primary text-center mb-1">Set a new password</h1>
        <p className="text-text-muted text-sm text-center mb-7">Choose something you'll remember</p>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-1.5">New Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-pool-dark focus:ring-2 focus:ring-pool-dark/10 transition-all bg-surface"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-1.5">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat your new password"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-pool-dark focus:ring-2 focus:ring-pool-dark/10 transition-all bg-surface"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-pool-dark text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity text-sm mt-2 disabled:opacity-60"
          >
            {loading ? 'Saving…' : 'Update Password →'}
          </button>
        </form>
      </div>
    </div>
  )
}
