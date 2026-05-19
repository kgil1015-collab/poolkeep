'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

import type { TreatmentStep } from '@/lib/recommendations'

type User = { email: string; user_metadata: { full_name?: string } }

type TestResult = {
  health_score: number
  tested_at: string
  ph: number | null
  free_chlorine: number | null
  total_alkalinity: number | null
  cya: number | null
  calcium_hardness: number | null
  salt: number | null
  recommendations: {
    treatment_plan?: TreatmentStep[]
    unknown: { title: string; desc: string; tags: string[] }[]
    action: { title: string; desc: string; tags: string[] }[]
    monitor: { title: string; desc: string; tags: string[] }[]
    good: { title: string; desc: string }[]
  }
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 60) return `${diff}m ago`
  if (diff < 1440) return `${Math.floor(diff/60)}h ago`
  return `${Math.floor(diff/1440)}d ago`
}

function scoreLabel(score: number) {
  if (score >= 90) return 'Excellent condition'
  if (score >= 75) return 'Good condition'
  if (score >= 55) return 'Needs attention'
  return 'Action required'
}


const IconCheck = ({ size = 18, style }: { size?: number; style?: React.CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={style}><polyline points="20 6 9 17 4 12"/></svg>
)
const IconHistory = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="12 8 12 12 14 14"/><path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"/></svg>
)
const IconShare = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
)
const IconPro = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
)
const IconDashboard = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
)

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [pool, setPool] = useState<{ id: string; name: string } | null>(null)
  const [lastTest, setLastTest] = useState<TestResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUser(data.user as User)
      const { data: pools } = await supabase.from('pools').select('id,name').limit(1)
      if (!pools || pools.length === 0) { router.push('/setup/pool'); return }
      setPool(pools[0])
      const { data: tests } = await supabase.from('test_results').select('health_score,recommendations,tested_at,ph,free_chlorine,total_alkalinity,cya,calcium_hardness,salt').eq('pool_id', pools[0].id).order('tested_at', { ascending: false }).limit(1)
      if (tests && tests.length > 0) setLastTest(tests[0])
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
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="min-h-screen bg-surface flex flex-col" style={{maxWidth:480,margin:'0 auto'}}>

      {/* Header */}
      <div className="bg-pool-deep px-5 pt-5 pb-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <svg viewBox="28 8 144 175" width="16" height="22" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="hg" x1=".35" y1="0" x2=".65" y2="1"><stop offset="0%" stopColor="#92D5F5"/><stop offset="42%" stopColor="#3A8AC8"/><stop offset="100%" stopColor="#052C4E"/></linearGradient>
                <clipPath id="hc"><path d="M100 8C100 8 28 88 28 124C28 163 61 183 100 183C139 183 172 163 172 124C172 88 100 8 100 8Z"/></clipPath>
              </defs>
              <path d="M100 8C100 8 28 88 28 124C28 163 61 183 100 183C139 183 172 163 172 124C172 88 100 8 100 8Z" fill="url(#hg)"/>
              <g clipPath="url(#hc)" fill="none" stroke="white" strokeLinecap="round">
                <path d="M46 145Q100 122 154 145" strokeWidth="5" opacity=".8"/>
                <path d="M38 160Q100 136 162 160" strokeWidth="4.5" opacity=".6"/>
                <path d="M50 173Q100 152 150 173" strokeWidth="4" opacity=".4"/>
              </g>
            </svg>
            <span className="text-white text-base" style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:300,letterSpacing:'-.01em'}}>
              Pool<span style={{fontWeight:800}}>Keep</span>
            </span>
          </div>
          <button onClick={handleSignOut} className="text-white/40 text-xs hover:text-white/60 transition-colors">Sign out</button>
        </div>

        <p className="text-white/55 text-sm mb-0.5">{greeting}, {firstName}</p>
        <h1 className="text-white text-2xl font-bold mb-4" style={{fontFamily:"'Oswald',sans-serif",letterSpacing:'-.01em'}}>Pool Status</h1>

        {/* Pool pill */}
        <div className="inline-flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5 mb-6">
          <div className="w-1.5 h-1.5 rounded-full bg-teal" />
          <span className="text-white/80 text-xs font-medium">
            {pool?.name ?? 'My Pool'} · {lastTest ? `Last tested ${timeAgo(lastTest.tested_at)}` : 'No tests yet'}
          </span>
        </div>

        {/* Health score */}
        <div className="text-center pb-4">
          <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-1">Health Score</p>
          <p className="text-white font-bold leading-none mb-2" style={{fontSize:72,fontFamily:"'Oswald',sans-serif"}}>
            {lastTest ? lastTest.health_score : '—'}
          </p>
          <div className="inline-flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-teal" />
            <span className="text-teal text-sm font-semibold">
              {lastTest ? scoreLabel(lastTest.health_score) : 'Log your first test'}
            </span>
          </div>
        </div>
      </div>

      {/* Wave transition */}
      <div className="bg-pool-deep">
        <svg viewBox="0 0 480 32" xmlns="http://www.w3.org/2000/svg" className="w-full block" style={{display:'block',marginBottom:-1}}>
          <path d="M0,28 C160,30 300,6 480,12 L480,32 L0,32 Z" fill="#F0F6FA"/>
        </svg>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pt-3 pb-24 bg-surface">
        {!lastTest ? (
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <p className="text-text-primary font-semibold mb-1">No tests logged yet</p>
            <p className="text-text-muted text-sm mb-4">Tap the + button below to log your first water test.</p>
            <button onClick={() => router.push('/log')} className="bg-pool-dark text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity">
              Log First Test →
            </button>
          </div>
        ) : (
          <>
            {/* Results at a glance */}
            <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3">Results</p>
            <div className="grid grid-cols-3 gap-2 mb-6">
              {[
                { key: 'ph', label: 'pH', fmt: (v: number) => v.toFixed(1) },
                { key: 'free_chlorine', label: 'Chlorine', fmt: (v: number) => `${v} ppm` },
                { key: 'total_alkalinity', label: 'Alkalinity', fmt: (v: number) => `${v} ppm` },
                { key: 'cya', label: 'CYA', fmt: (v: number) => `${v} ppm` },
                { key: 'calcium_hardness', label: 'Calcium', fmt: (v: number) => `${v} ppm` },
                { key: 'salt', label: 'Salt', fmt: (v: number) => `${v} ppm` },
              ].map(p => {
                const raw = lastTest[p.key as keyof TestResult]
                const val = typeof raw === 'number' ? raw : null
                const paramKey = { ph: 'ph', free_chlorine: 'chlorine', total_alkalinity: 'alkalinity', cya: 'cya', calcium_hardness: 'calcium', salt: 'salt' }[p.key]
                const isAction = lastTest.recommendations.action.some(r => r && (r as {title:string;desc:string;tags:string[]}&{param?:string}).param === paramKey || lastTest.recommendations.action.some(r2 => r2.title.toLowerCase().includes(p.label.toLowerCase())))
                const isMonitor = !isAction && lastTest.recommendations.monitor.some(r => r.title.toLowerCase().includes(p.label.toLowerCase()))
                const isGood = !isAction && !isMonitor && val !== null && lastTest.recommendations.good.some(r => r.title.toLowerCase().includes(p.label.toLowerCase()))
                const color = val === null ? '#8AAABB' : isAction ? '#E5304A' : isMonitor ? '#D48800' : isGood ? '#1DB869' : '#8AAABB'
                const dot = val === null ? '#C5D8E4' : isAction ? '#E5304A' : isMonitor ? '#F5A623' : isGood ? '#1DB869' : '#C5D8E4'
                const statusLabel = val === null ? 'Not tested' : isAction ? 'Action' : isMonitor ? 'Monitor' : isGood ? 'Good' : '—'
                return (
                  <div key={p.key} className="bg-white rounded-xl px-3 py-2.5 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{p.label}</p>
                    <p className="text-sm font-bold mt-0.5 leading-tight" style={{fontFamily:"'DM Mono',monospace", color}}>
                      {val !== null ? p.fmt(val) : '—'}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{background: dot}} />
                      <span className="text-[9px] font-medium text-text-faint">{statusLabel}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Treatment plan */}
            {lastTest.recommendations.treatment_plan && lastTest.recommendations.treatment_plan.length > 0 ? (
              <>
                <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3">Treatment Plan</p>
                <div className="space-y-4 mb-6">
                  {lastTest.recommendations.treatment_plan.map(step => {
                    const urgencyStyle = step.urgency === 'urgent'
                      ? { badge: '#E5304A', badgeBg: 'rgba(229,48,74,0.1)', label: 'Urgent' }
                      : step.urgency === 'soon'
                      ? { badge: '#D48800', badgeBg: 'rgba(245,166,35,0.1)', label: 'Soon' }
                      : { badge: '#0078B8', badgeBg: 'rgba(0,120,184,0.08)', label: 'Routine' }
                    return (
                      <div key={step.step} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        {/* Step header */}
                        <div className="px-4 pt-4 pb-3 flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm text-white" style={{background: urgencyStyle.badge, fontFamily:"'Oswald',sans-serif"}}>
                            {step.step}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{background: urgencyStyle.badgeBg, color: urgencyStyle.badge}}>{urgencyStyle.label}</span>
                            </div>
                            <p className="font-bold text-text-primary text-sm leading-snug">{step.title}</p>
                            {step.chemical && (
                              <div className="mt-2 inline-flex items-center gap-1.5 bg-surface rounded-lg px-2.5 py-1.5">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2.2" strokeLinecap="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>
                                <span className="text-xs font-bold" style={{color:'#0078B8'}}>{step.chemical}</span>
                                {step.amount && <span className="text-xs font-bold text-text-muted">· {step.amount}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Details */}
                        <div className="px-4 pb-4 space-y-3 border-t border-gray-50 pt-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{color:'#0078B8'}}>Why</p>
                            <p className="text-xs text-text-muted leading-relaxed">{step.why}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{color:'#0078B8'}}>How to apply</p>
                            <p className="text-xs text-text-muted leading-relaxed">{step.how}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{color:'#0078B8'}}>What to look for</p>
                            <p className="text-xs text-text-muted leading-relaxed">{step.lookFor}</p>
                          </div>
                          {step.note && (
                            <div className="bg-amber-50 rounded-xl px-3 py-2.5 flex gap-2">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D48800" strokeWidth="2.2" strokeLinecap="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                              <p className="text-[11px] text-amber-800 leading-relaxed">{step.note}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : lastTest.recommendations.action.length === 0 && lastTest.recommendations.monitor.length === 0 ? (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{background:'rgba(29,184,105,0.1)'}}>
                  <IconCheck size={20} style={{color:'#1DB869'}} />
                </div>
                <div>
                  <p className="font-bold text-text-primary text-sm">Water is balanced</p>
                  <p className="text-text-muted text-xs mt-0.5">All tested parameters are in range. No action needed.</p>
                </div>
              </div>
            ) : null}

            {/* Looking good — with descriptions */}
            {lastTest.recommendations.good.length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Looking Good</p>
                <div className="space-y-2">
                  {lastTest.recommendations.good.map((a, i) => (
                    <div key={i} className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{background:'rgba(29,184,105,0.1)'}}>
                        <IconCheck size={13} style={{color:'#1DB869'}} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-text-primary">{a.title}</p>
                        <p className="text-xs text-text-muted leading-relaxed mt-0.5">{a.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Not tested */}
            {lastTest.recommendations.unknown && lastTest.recommendations.unknown.length > 0 && (
              <>
                <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3">Not Tested</p>
                <div className="space-y-3">
                  {lastTest.recommendations.unknown.map((a, i) => (
                    <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 opacity-80">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{background:'rgba(74,106,124,0.12)'}}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4A6A7C" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm mb-1 text-text-primary">{a.title}</p>
                          <p className="text-text-muted text-xs leading-relaxed mb-2.5">{a.desc}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {a.tags.map((t:string) => <span key={t} className="text-xs font-medium px-2.5 py-1 rounded-full" style={{background:'#F0F6FA',color:'#8AAABB'}}>{t}</span>)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Bottom tab bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-2">
        <div className="flex items-center justify-around py-2 max-w-md mx-auto">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: <IconDashboard /> },
            { id: 'history', label: 'History', icon: <IconHistory /> },
            { id: 'log', label: '', icon: null },
            { id: 'share', label: 'Share', icon: <IconShare /> },
            { id: 'pro', label: 'Pro', icon: <IconPro /> },
          ].map(tab => {
            if (tab.id === 'log') return (
              <button key="log" onClick={() => router.push('/log')} className="w-14 h-14 rounded-full bg-pool-dark flex items-center justify-center shadow-lg -mt-5 border-4 border-white">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            )
            const active = tab.id === 'dashboard'
            return (
              <button key={tab.id} onClick={() => router.push(`/${tab.id === 'dashboard' ? 'dashboard' : tab.id}`)} className="flex flex-col items-center gap-1 px-3 py-1 min-w-0">
                <span style={{color: active ? '#0078B8' : '#8AAABB'}}>{tab.icon}</span>
                <span className="text-[10px] font-medium" style={{color: active ? '#0078B8' : '#8AAABB'}}>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
