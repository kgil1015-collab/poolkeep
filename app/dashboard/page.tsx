'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type User = { email: string; user_metadata: { full_name?: string } }

function IconTest() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8l-5-5z"/>
      <polyline points="9 3 9 8 19 8"/>
      <line x1="8" y1="13" x2="16" y2="13"/>
      <line x1="8" y1="17" x2="12" y2="17"/>
    </svg>
  )
}

function IconHistory() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="12 8 12 12 14 14"/>
      <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"/>
    </svg>
  )
}

function IconShare() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
      <polyline points="16 6 12 2 8 6"/>
      <line x1="12" y1="2" x2="12" y2="15"/>
    </svg>
  )
}

function IconSettings() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}

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
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-5 h-5 border-2 border-pool-dark border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'there'

  const actions = [
    { icon: <IconTest />, label: 'Log a Test', sub: 'Enter your readings', color: '#0078B8' },
    { icon: <IconHistory />, label: 'History', sub: 'Past results', color: '#0078B8' },
    { icon: <IconShare />, label: 'Share Report', sub: 'Send to your pro', color: '#0078B8' },
    { icon: <IconSettings />, label: 'Settings', sub: 'Pool & account', color: '#0078B8' },
  ]

  return (
    <div className="min-h-screen bg-surface">
      {/* Header — navy, includes greeting */}
      <div className="bg-pool-deep px-5 pt-4 pb-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <svg viewBox="28 8 144 175" width="18" height="24" xmlns="http://www.w3.org/2000/svg">
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
            <span className="text-white text-base tracking-tight" style={{fontFamily:"'Space Grotesk',sans-serif"}}>
              <span style={{fontWeight:300}}>Pool</span><span style={{fontWeight:800}}>Keep</span>
            </span>
          </div>
          <button onClick={handleSignOut} className="text-white/40 text-xs hover:text-white/70 transition-colors">
            Sign out
          </button>
        </div>
        <p className="text-white/50 text-xs font-medium uppercase tracking-widest mb-1">Welcome back</p>
        <h1 className="text-white text-2xl font-bold">{firstName}</h1>
      </div>

      {/* Content lifts over header */}
      <div className="max-w-md mx-auto px-4 -mt-4 pb-12">

        {/* Add pool CTA */}
        <div className="bg-white rounded-2xl p-4 mb-4 shadow-md flex items-center gap-4 border-l-4 border-teal">
          <div className="flex-1">
            <p className="text-text-primary font-semibold text-sm mb-0.5">Set up your pool</p>
            <p className="text-text-muted text-xs leading-relaxed">Add size and type for personalized doses.</p>
          </div>
          <button className="shrink-0 bg-pool-dark text-white text-xs font-bold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity whitespace-nowrap">
            Add Pool
          </button>
        </div>

        {/* Last test */}
        <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-3">Last Test</p>
          <div className="flex items-center justify-center py-5">
            <p className="text-text-muted text-sm">No tests logged yet</p>
          </div>
        </div>

        {/* Quick Actions */}
        <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-3 mt-2">Actions</p>
        <div className="grid grid-cols-2 gap-3">
          {actions.map(a => (
            <button key={a.label} className="bg-white rounded-2xl p-4 shadow-sm text-left active:scale-95 transition-transform border border-gray-100">
              <div className="w-9 h-9 rounded-xl bg-surface flex items-center justify-center text-pool-dark mb-3">
                {a.icon}
              </div>
              <p className="font-semibold text-text-primary text-sm">{a.label}</p>
              <p className="text-text-muted text-xs mt-0.5">{a.sub}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
