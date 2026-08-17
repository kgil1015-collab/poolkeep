'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name || !email || !password) { setError('Please fill in all fields.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)

    const supabase = createClient()
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    })

    setLoading(false)
    if (signUpError) { setError(signUpError.message); return }

    // Fire welcome email — non-blocking, don't hold up the success screen
    fetch('/api/welcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name }),
    }).catch(() => {})

    setSuccess(true)
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{background:'linear-gradient(172deg,#e8f5ff 0%,#c4dff5 38%,#9ac4e8 70%,#6ba8d8 100%)'}}>
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 text-center">
          <div className="text-4xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">Check your email!</h1>
          <p className="text-text-muted text-sm mb-6">We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.</p>
          <Link href="/login" className="text-pool-dark font-semibold hover:underline text-sm">Back to Sign In</Link>
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
              <linearGradient id="sd" x1=".35" y1="0" x2=".65" y2="1"><stop offset="0%" stopColor="#92D5F5"/><stop offset="42%" stopColor="#3A8AC8"/><stop offset="100%" stopColor="#052C4E"/></linearGradient>
              <radialGradient id="sg" cx="42%" cy="25%" r="40%"><stop offset="0%" stopColor="#fff" stopOpacity=".5"/><stop offset="100%" stopColor="#fff" stopOpacity="0"/></radialGradient>
              <clipPath id="sc"><path d="M100 8C100 8 28 88 28 124C28 163 61 183 100 183C139 183 172 163 172 124C172 88 100 8 100 8Z"/></clipPath>
            </defs>
            <path d="M100 8C100 8 28 88 28 124C28 163 61 183 100 183C139 183 172 163 172 124C172 88 100 8 100 8Z" fill="url(#sd)"/>
            <path d="M100 8C100 8 28 88 28 124C28 163 61 183 100 183C139 183 172 163 172 124C172 88 100 8 100 8Z" fill="url(#sg)"/>
            <g clipPath="url(#sc)" fill="none" stroke="white" strokeLinecap="round">
              <path d="M46 145Q100 122 154 145" strokeWidth="4.5" opacity=".82"/>
              <path d="M38 160Q100 136 162 160" strokeWidth="4" opacity=".62"/>
              <path d="M50 173Q100 152 150 173" strokeWidth="3.5" opacity=".42"/>
            </g>
          </svg>
          <span className="text-pool-deep text-2xl tracking-tight" style={{fontFamily:"'Space Grotesk',sans-serif"}}>
            <span style={{fontWeight:300}}>Pool</span><span style={{fontWeight:800}}>Keep</span>
          </span>
        </div>
        <h1 className="text-2xl font-bold text-text-primary text-center mb-1">Create your account</h1>
        <p className="text-text-muted text-sm text-center mb-7">Free to start · No credit card required</p>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-1.5">Full Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Dave Miller" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base outline-none focus:border-pool-dark focus:ring-2 focus:ring-pool-dark/10 transition-all bg-surface" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base outline-none focus:border-pool-dark focus:ring-2 focus:ring-pool-dark/10 transition-all bg-surface" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-1.5">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base outline-none focus:border-pool-dark focus:ring-2 focus:ring-pool-dark/10 transition-all bg-surface" />
          </div>
          <button type="submit" disabled={loading} className="w-full font-bold py-3 rounded-xl hover:opacity-90 transition-opacity text-sm mt-2 disabled:opacity-60" style={{background:'#00E0B0',color:'#003D5C'}}>
            {loading ? 'Creating account…' : 'Get Started Free →'}
          </button>
          <p className="text-center text-[11px] text-text-faint mt-2">
            By signing up you agree to our{' '}
            <a href="/terms" className="underline hover:text-text-muted">Terms</a>
            {' '}and{' '}
            <a href="/privacy" className="underline hover:text-text-muted">Privacy Policy</a>
          </p>
        </form>

        <p className="text-center text-sm text-text-muted mt-5">
          Already have an account?{' '}
          <Link href="/login" className="text-pool-dark font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
