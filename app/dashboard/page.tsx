'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

type User = { email: string; user_metadata: { full_name?: string } }

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUser(data.user as User)
      setLoading(false)
    })
  }, [router])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{background:'#F0F6FA'}}>
        <div className="text-text-muted text-sm">Loading…</div>
      </div>
    )
  }

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'there'

  return (
    <div className="min-h-screen" style={{background:'#F0F6FA'}}>
      {/* Nav */}
      <nav className="bg-pool-deep px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg viewBox="28 8 144 175" width="20" height="26" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="dd" x1=".35" y1="0" x2=".65" y2="1"><stop offset="0%" stopColor="#92D5F5"/><stop offset="42%" stopColor="#3A8AC8"/><stop offset="100%" stopColor="#052C4E"/></linearGradient>
              <radialGradient id="dg" cx="42%" cy="25%" r="40%"><stop offset="0%" stopColor="#fff" stopOpacity=".5"/><stop offset="100%" stopColor="#fff" stopOpacity="0"/></radialGradient>
              <clipPath id="dc"><path d="M100 8C100 8 28 88 28 124C28 163 61 183 100 183C139 183 172 163 172 124C172 88 100 8 100 8Z"/></clipPath>
            </defs>
            <path d="M100 8C100 8 28 88 28 124C28 163 61 183 100 183C139 183 172 163 172 124C172 88 100 8 100 8Z" fill="url(#dd)"/>
            <path d="M100 8C100 8 28 88 28 124C28 163 61 183 100 183C139 183 172 163 172 124C172 88 100 8 100 8Z" fill="url(#dg)"/>
            <g clipPath="url(#dc)" fill="none" stroke="white" strokeLinecap="round">
              <path d="M46 145Q100 122 154 145" strokeWidth="4.5" opacity=".82"/>
              <path d="M38 160Q100 136 162 160" strokeWidth="4" opacity=".62"/>
              <path d="M50 173Q100 152 150 173" strokeWidth="3.5" opacity=".42"/>
            </g>
          </svg>
          <span className="text-white text-lg tracking-tight" style={{fontFamily:"'Space Grotesk',sans-serif"}}>
            <span style={{fontWeight:300}}>Pool</span><span style={{fontWeight:800}}>Keep</span>
          </span>
        </div>
        <button onClick={handleSignOut} className="text-white/60 text-xs hover:text-white transition-colors">
          Sign out
        </button>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-primary" style={{fontFamily:"'Oswald',sans-serif"}}>
            Hey, {firstName} 👋
          </h1>
          <p className="text-text-muted text-sm mt-1">Ready to check on your pool?</p>
        </div>

        {/* No pool yet */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6 text-center border border-dashed border-gray-200">
          <div className="text-4xl mb-3">🏊</div>
          <h2 className="font-bold text-text-primary mb-1">No pool set up yet</h2>
          <p className="text-text-muted text-sm mb-4">Add your pool to start getting personalized chemical recommendations.</p>
          <button className="bg-pool-dark text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity">
            Add My Pool
          </button>
        </div>

        {/* Quick Actions */}
        <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <button className="bg-white rounded-2xl p-5 shadow-sm text-left hover:shadow-md transition-shadow">
            <div className="text-2xl mb-2">🧪</div>
            <div className="font-bold text-text-primary text-sm">Log a Test</div>
            <div className="text-text-muted text-xs mt-0.5">Enter your readings</div>
          </button>
          <button className="bg-white rounded-2xl p-5 shadow-sm text-left hover:shadow-md transition-shadow">
            <div className="text-2xl mb-2">📋</div>
            <div className="font-bold text-text-primary text-sm">View History</div>
            <div className="text-text-muted text-xs mt-0.5">Past test results</div>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button className="bg-white rounded-2xl p-5 shadow-sm text-left hover:shadow-md transition-shadow">
            <div className="text-2xl mb-2">📤</div>
            <div className="font-bold text-text-primary text-sm">Share Report</div>
            <div className="text-text-muted text-xs mt-0.5">Send to your pro</div>
          </button>
          <Link href="/" className="bg-white rounded-2xl p-5 shadow-sm text-left hover:shadow-md transition-shadow block">
            <div className="text-2xl mb-2">⚙️</div>
            <div className="font-bold text-text-primary text-sm">Settings</div>
            <div className="text-text-muted text-xs mt-0.5">Pool & account</div>
          </Link>
        </div>
      </div>
    </div>
  )
}
