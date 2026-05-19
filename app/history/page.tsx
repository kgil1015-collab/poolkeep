'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type TestResult = {
  id: string
  tested_at: string
  health_score: number
  ph: number | null
  free_chlorine: number | null
  total_alkalinity: number | null
  cya: number | null
  calcium_hardness: number | null
  salt: number | null
  recommendations: {
    action: { title: string; desc: string; tags: string[] }[]
    monitor: { title: string; desc: string; tags: string[] }[]
    good: { title: string; desc: string }[]
    unknown: { title: string }[]
  }
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function scoreColor(score: number) {
  if (score >= 90) return { bg: 'rgba(29,184,105,0.12)', text: '#1DB869' }
  if (score >= 75) return { bg: 'rgba(0,120,184,0.1)', text: '#0078B8' }
  if (score >= 55) return { bg: 'rgba(245,166,35,0.12)', text: '#D48800' }
  return { bg: 'rgba(229,48,74,0.1)', text: '#E5304A' }
}

function scoreLabel(score: number) {
  if (score >= 90) return 'Excellent'
  if (score >= 75) return 'Good'
  if (score >= 55) return 'Fair'
  return 'Poor'
}

const PARAM_LABELS: Record<string, string> = {
  ph: 'pH',
  free_chlorine: 'Cl',
  total_alkalinity: 'TA',
  cya: 'CYA',
  calcium_hardness: 'Ca',
  salt: 'Salt',
}

export default function HistoryPage() {
  const router = useRouter()
  const [tests, setTests] = useState<TestResult[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [pool, setPool] = useState<{ name: string } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      const { data: pools } = await supabase.from('pools').select('id,name').limit(1)
      if (!pools || pools.length === 0) { router.push('/setup/pool'); return }
      setPool(pools[0])
      const { data: results } = await supabase
        .from('test_results')
        .select('id,tested_at,health_score,ph,free_chlorine,total_alkalinity,cya,calcium_hardness,salt,recommendations')
        .eq('pool_id', pools[0].id)
        .order('tested_at', { ascending: false })
        .limit(50)
      setTests(results ?? [])
      setLoading(false)
    })
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-5 h-5 border-2 border-pool-dark border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col" style={{maxWidth:480,margin:'0 auto'}}>

      {/* Header */}
      <div className="bg-pool-deep px-5 pt-5 pb-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/dashboard')} className="text-white/60 hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span className="text-white text-base" style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:300}}>
            Pool<span style={{fontWeight:800}}>Keep</span>
          </span>
        </div>
        <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-1">{pool?.name ?? 'My Pool'}</p>
        <h1 className="text-white text-2xl font-bold" style={{fontFamily:"'Oswald',sans-serif",letterSpacing:'-.01em'}}>Test History</h1>
        <p className="text-white/55 text-sm mt-1">{tests.length} {tests.length === 1 ? 'test' : 'tests'} logged</p>
      </div>

      {/* Wave */}
      <div className="bg-pool-deep">
        <svg viewBox="0 0 480 32" xmlns="http://www.w3.org/2000/svg" className="w-full block" style={{display:'block',marginBottom:-1}}>
          <path d="M0,28 C160,30 300,6 480,12 L480,32 L0,32 Z" fill="#F0F6FA"/>
        </svg>
      </div>

      {/* List */}
      <div className="flex-1 px-4 pt-3 pb-24 bg-surface">
        {tests.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center mt-2">
            <p className="text-text-primary font-semibold mb-1">No tests yet</p>
            <p className="text-text-muted text-sm mb-4">Tap the + on the dashboard to log your first water test.</p>
            <button onClick={() => router.push('/log')} className="bg-pool-dark text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity">
              Log a Test →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {tests.map(test => {
              const colors = scoreColor(test.health_score)
              const isOpen = expanded === test.id
              const testedParams = Object.entries(PARAM_LABELS).filter(([key]) => test[key as keyof TestResult] !== null)
              const actionCount = test.recommendations?.action?.length ?? 0
              const monitorCount = test.recommendations?.monitor?.length ?? 0

              return (
                <div key={test.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  {/* Row */}
                  <button
                    className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                    onClick={() => setExpanded(isOpen ? null : test.id)}
                  >
                    {/* Score badge */}
                    <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0" style={{background: colors.bg}}>
                      <span className="text-lg font-bold leading-none" style={{fontFamily:"'Oswald',sans-serif",color: colors.text}}>{test.health_score}</span>
                      <span className="text-[9px] font-semibold uppercase tracking-wide" style={{color: colors.text}}>{scoreLabel(test.health_score)}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-bold text-sm text-text-primary">{formatDate(test.tested_at)}</p>
                        <p className="text-[11px] text-text-faint shrink-0">{formatTime(test.tested_at)}</p>
                      </div>
                      {/* Param chips */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {testedParams.map(([key, label]) => (
                          <span key={key} className="text-[10px] font-medium px-1.5 py-0.5 rounded-md" style={{background:'#F0F6FA',color:'#4A6A7C'}}>
                            {label} {key === 'ph' ? (test[key as 'ph'] as number)?.toFixed(1) : (test[key as 'free_chlorine' | 'total_alkalinity' | 'cya' | 'calcium_hardness' | 'salt'] as number)}
                          </span>
                        ))}
                      </div>
                      {/* Summary line */}
                      {(actionCount + monitorCount) > 0 ? (
                        <p className="text-[11px] text-text-muted mt-1.5">
                          {actionCount > 0 && <span className="text-red-500 font-semibold">{actionCount} action{actionCount > 1 ? 's' : ''}</span>}
                          {actionCount > 0 && monitorCount > 0 && <span className="text-text-faint"> · </span>}
                          {monitorCount > 0 && <span style={{color:'#D48800'}} className="font-semibold">{monitorCount} to monitor</span>}
                        </p>
                      ) : (
                        <p className="text-[11px] mt-1.5 font-semibold" style={{color:'#1DB869'}}>All clear</p>
                      )}
                    </div>

                    {/* Chevron */}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8AAABB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      style={{transform: isOpen ? 'rotate(180deg)' : 'none', transition:'transform .2s', flexShrink:0}}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="border-t border-gray-100 px-4 py-3 bg-surface/50">
                      {test.recommendations?.action?.length > 0 && (
                        <div className="mb-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Action Needed</p>
                          <div className="space-y-2">
                            {test.recommendations.action.map((r, i) => (
                              <div key={i} className="bg-white rounded-xl p-3 border border-red-50">
                                <p className="text-xs font-bold text-text-primary mb-0.5">{r.title}</p>
                                <p className="text-[11px] text-text-muted leading-relaxed">{r.desc}</p>
                                {r.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {r.tags.map(t => <span key={t} className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{background:'rgba(229,48,74,0.08)',color:'#E5304A'}}>{t}</span>)}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {test.recommendations?.monitor?.length > 0 && (
                        <div className="mb-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Keep an Eye On</p>
                          <div className="space-y-2">
                            {test.recommendations.monitor.map((r, i) => (
                              <div key={i} className="bg-white rounded-xl p-3 border border-yellow-50">
                                <p className="text-xs font-bold text-text-primary mb-0.5">{r.title}</p>
                                <p className="text-[11px] text-text-muted leading-relaxed">{r.desc}</p>
                                {r.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {r.tags.map(t => <span key={t} className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{background:'rgba(245,166,35,0.1)',color:'#D48800'}}>{t}</span>)}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {test.recommendations?.good?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Looking Good</p>
                          <div className="flex flex-wrap gap-1.5">
                            {test.recommendations.good.map((r, i) => (
                              <span key={i} className="text-[11px] font-medium px-2.5 py-1 rounded-full" style={{background:'rgba(29,184,105,0.1)',color:'#1DB869'}}>{r.title}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom tab bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-2">
        <div className="flex items-center justify-around py-2 max-w-md mx-auto">
          {[
            { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
            { id: 'history', label: 'History', path: '/history', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="12 8 12 12 14 14"/><path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"/></svg> },
            { id: 'log', label: '', path: '/log', icon: null },
            { id: 'share', label: 'Share', path: '/share', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> },
            { id: 'pro', label: 'Pro', path: '/pro', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
          ].map(tab => {
            if (tab.id === 'log') return (
              <button key="log" onClick={() => router.push('/log')} className="w-14 h-14 rounded-full bg-pool-dark flex items-center justify-center shadow-lg -mt-5 border-4 border-white">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            )
            const active = tab.id === 'history'
            return (
              <button key={tab.id} onClick={() => router.push(tab.path)} className="flex flex-col items-center gap-1 px-3 py-1 min-w-0">
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
