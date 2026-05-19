'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Please enter your email and password.'); return }
    setLoading(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)
    if (signInError) { setError(signInError.message); return }
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{background:'linear-gradient(172deg,#e8f5ff 0%,#c4dff5 38%,#9ac4e8 70%,#6ba8d8 100%)'}}>
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8">
        <div className="text-center mb-6">
          <Image src="/logo.png" alt="PoolKeep" width={120} height={120} className="mx-auto mb-2" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary text-center mb-1">Welcome back</h1>
        <p className="text-text-muted text-sm text-center mb-7">Sign in to your PoolKeep account</p>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-pool-dark focus:ring-2 focus:ring-pool-dark/10 transition-all bg-surface" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-1.5">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-pool-dark focus:ring-2 focus:ring-pool-dark/10 transition-all bg-surface" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-pool-dark text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity text-sm mt-2 disabled:opacity-60">
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>

        <p className="text-center text-sm text-text-muted mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-pool-dark font-semibold hover:underline">Sign up free</Link>
        </p>
      </div>
    </div>
  )
}
