'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

import type { TreatmentStep, MaintenanceTip } from '@/lib/recommendations'

type User = { email: string; user_metadata: { full_name?: string } }

type TestResult = {
  health_score: number
  created_at: string
  ph: number | null
  free_chlorine: number | null
  total_alkalinity: number | null
  cya: number | null
  calcium_hardness: number | null
  salt: number | null
  recommendations: {
    treatment_plan?: TreatmentStep[]
    maintenance?: MaintenanceTip[]
    unknown: { param: string; title: string; desc: string; tags: string[] }[]
    action:  { param: string; title: string; desc: string; tags: string[] }[]
    monitor: { param: string; title: string; desc: string; tags: string[] }[]
    good:    { param: string; title: string; desc: string; tags: string[] }[]
  }
}

function timeAgo(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000)
  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (diffMin < 60) return `${diffMin}m ago`
  const diffDays = Math.floor(diffMin / 1440)
  if (diffDays === 0) return `Today at ${timeStr}`
  if (diffDays === 1) return `Yesterday at ${timeStr}`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` at ${timeStr}`
}

function scoreLabel(score: number) {
  if (score >= 90) return 'Excellent condition'
  if (score >= 75) return 'Good condition'
  if (score >= 55) return 'Needs attention'
  return 'Action required'
}

function statusAccent(score: number | null) {
  if (score === null) return { color: '#00CCA3', overlay: 'none' }
  if (score >= 90) return { color: '#00E0B0', overlay: 'none' }
  if (score >= 75) return { color: '#3AB5E6', overlay: 'none' }
  if (score >= 55) return { color: '#F5A623', overlay: 'radial-gradient(ellipse at 60% 10%, rgba(245,166,35,0.28) 0%, transparent 60%)' }
  return { color: '#FF6B7A', overlay: 'radial-gradient(ellipse at 60% 10%, rgba(229,48,74,0.32) 0%, transparent 60%)' }
}

const PARAM_RANGES = [
  { key: 'ph',               label: 'pH',        fmt: (v:number) => v.toFixed(1),        unit: '',    idealMin: 7.2,  idealMax: 7.6,  viewMin: 6.5,  viewMax: 8.5  },
  { key: 'free_chlorine',    label: 'Chlorine',  fmt: (v:number) => v.toFixed(1),        unit: 'ppm', idealMin: 1,    idealMax: 3,    viewMin: 0,    viewMax: 6    },
  { key: 'total_alkalinity', label: 'Alkalinity',fmt: (v:number) => String(Math.round(v)),unit: 'ppm', idealMin: 80,   idealMax: 120,  viewMin: 40,   viewMax: 180  },
  { key: 'cya',              label: 'CYA',       fmt: (v:number) => String(Math.round(v)),unit: 'ppm', idealMin: 30,   idealMax: 50,   viewMin: 0,    viewMax: 120  },
  { key: 'calcium_hardness', label: 'Calcium',   fmt: (v:number) => String(Math.round(v)),unit: 'ppm', idealMin: 200,  idealMax: 400,  viewMin: 100,  viewMax: 600  },
  { key: 'salt',             label: 'Salt',      fmt: (v:number) => String(Math.round(v)),unit: 'ppm', idealMin: 2700, idealMax: 3400, viewMin: 2000, viewMax: 5000 },
]


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
  const [pool, setPool] = useState<{ id: string; name: string; remind_after_days: number | null } | null>(null)
  const [allPools, setAllPools] = useState<{ id: string; name: string; remind_after_days: number | null }[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [isPro, setIsPro] = useState(false)
  const [lastTest, setLastTest] = useState<TestResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [remindDays, setRemindDays] = useState<number | null>(null)
  const [savingReminder, setSavingReminder] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (sessionStorage.getItem('poolkeep_just_logged')) {
      sessionStorage.removeItem('poolkeep_just_logged')
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3000)
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUser(data.user as User)
      const [{ data: profile }, { data: pools }] = await Promise.all([
        supabase.from('profiles').select('subscription_status').eq('id', data.user.id).maybeSingle(),
        supabase.from('pools').select('id,name,remind_after_days').order('created_at', { ascending: true }),
      ])
      const pro = profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing'
      setIsPro(pro)
      if (!pools || pools.length === 0) { router.push('/setup/pool'); return }
      setAllPools(pools)
      const savedId = typeof window !== 'undefined' ? localStorage.getItem('poolkeep_active_pool') : null
      const active = (savedId && pools.find(p => p.id === savedId)) || pools[0]
      localStorage.setItem('poolkeep_active_pool', active.id)
      setPool(active)
      setRemindDays(active.remind_after_days ?? null)
      const { data: tests } = await supabase.from('test_results').select('health_score,recommendations,created_at,ph,free_chlorine,total_alkalinity,cya,calcium_hardness,salt').eq('pool_id', active.id).order('created_at', { ascending: false }).limit(1)
      if (tests && tests.length > 0) setLastTest(tests[0])
      setLoading(false)
    })
  }, [router])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  async function switchPool(p: { id: string; name: string; remind_after_days: number | null }) {
    setPool(p)
    setRemindDays(p.remind_after_days ?? null)
    setLastTest(null)
    setShowPicker(false)
    localStorage.setItem('poolkeep_active_pool', p.id)
    const supabase = createClient()
    const { data: tests } = await supabase
      .from('test_results')
      .select('health_score,recommendations,created_at,ph,free_chlorine,total_alkalinity,cya,calcium_hardness,salt')
      .eq('pool_id', p.id)
      .order('created_at', { ascending: false })
      .limit(1)
    if (tests && tests.length > 0) setLastTest(tests[0])
  }

  async function saveReminderDays(days: number | null) {
    if (!pool || savingReminder) return
    setSavingReminder(true)
    setRemindDays(days)
    const supabase = createClient()
    await supabase.from('pools').update({ remind_after_days: days }).eq('id', pool.id)
    setSavingReminder(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col" style={{maxWidth:480,margin:'0 auto'}}>
        <div className="bg-pool-deep px-5 pt-5 pb-8 animate-pulse">
          <div className="flex items-center justify-between mb-5">
            <div className="h-5 w-24 rounded-full bg-white/15" />
            <div className="h-4 w-14 rounded-full bg-white/10" />
          </div>
          <div className="h-3 w-32 rounded-full bg-white/15 mb-1.5" />
          <div className="h-6 w-28 rounded-full bg-white/20 mb-5" />
          <div className="h-6 w-40 rounded-full bg-white/10 mb-7" />
          <div className="flex flex-col items-center gap-3">
            <div className="w-28 h-28 rounded-full bg-white/10" />
            <div className="h-4 w-32 rounded-full bg-white/15" />
          </div>
        </div>
        <div className="bg-pool-deep"><svg viewBox="0 0 480 32" className="w-full block"><path d="M0,28 C160,30 300,6 480,12 L480,32 L0,32 Z" fill="#F0F6FA"/></svg></div>
        <div className="flex-1 px-4 pt-4 pb-24 animate-pulse space-y-3">
          <div className="h-20 rounded-2xl bg-white shadow-sm" />
          <div className="space-y-2">
            {[1,2,3,4].map(i => <div key={i} className="h-14 rounded-xl bg-white shadow-sm" />)}
          </div>
          <div className="h-32 rounded-2xl bg-white shadow-sm mt-2" />
        </div>
      </div>
    )
  }

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="min-h-screen bg-surface flex flex-col" style={{maxWidth:480,margin:'0 auto'}}>

      {/* Header */}
      <div className="bg-pool-deep px-5 pt-5 pb-6 relative overflow-hidden">
        {/* Dynamic status overlay */}
        {lastTest && (
          <div className="absolute inset-0 pointer-events-none" style={{background: statusAccent(lastTest.health_score).overlay}} />
        )}
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
          <div className="flex items-center gap-2">
            {isPro && (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{background:'rgba(0,224,176,0.18)',color:'#00E0B0'}}>Pro</span>
            )}
            <button onClick={handleSignOut} className="text-white/40 text-xs hover:text-white/60 transition-colors">Sign out</button>
          </div>
        </div>

        <p className="text-white/55 text-sm mb-0.5">{greeting}, {firstName}</p>
        <h1 className="text-white text-2xl font-bold mb-4" style={{fontFamily:"'Oswald',sans-serif",letterSpacing:'-.01em'}}>Pool Status</h1>

        {/* Pool switcher */}
        <div className="mb-6">
          <button
            onClick={() => setShowPicker(p => !p)}
            className="inline-flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-teal shrink-0" />
            <span className="text-white/80 text-xs font-medium">
              {pool?.name ?? 'My Pool'} · {lastTest ? `Last tested ${timeAgo(lastTest.created_at)}` : 'No tests yet'}
            </span>
            {allPools.length > 1 && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points={showPicker ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
              </svg>
            )}
          </button>

          {showPicker && (
            <div className="mt-2 bg-white rounded-2xl shadow-lg overflow-hidden">
              {allPools.map(p => (
                <button
                  key={p.id}
                  onClick={() => switchPool(p)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface transition-colors border-b border-gray-50 last:border-0"
                >
                  <div className="w-2 h-2 rounded-full shrink-0" style={{background: p.id === pool?.id ? '#00CCA3' : '#C5D8E4'}} />
                  <span className="text-sm font-medium text-text-primary flex-1">{p.name}</span>
                  {p.id === pool?.id && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00CCA3" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  )}
                </button>
              ))}
              <button
                onClick={() => { setShowPicker(false); router.push(isPro || allPools.length === 0 ? '/setup/pool' : '/pro') }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface transition-colors"
              >
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{background:'rgba(0,120,184,0.1)'}}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </div>
                <div className="flex-1 flex items-center justify-between">
                  <span className="text-sm font-medium" style={{color:'#0078B8'}}>Add Pool</span>
                  {!isPro && allPools.length >= 1 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{background:'rgba(0,224,176,0.15)',color:'#00967A'}}>Pro</span>
                  )}
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Health score — simple large number */}
        {(() => {
          const score = lastTest?.health_score ?? null
          const { color } = statusAccent(score)
          return (
            <div className="flex flex-col items-center pb-5">
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">Health Score</p>
              <p className="text-white font-bold leading-none" style={{fontSize:72,fontFamily:"'Oswald',sans-serif",letterSpacing:'-2px'}}>
                {score ?? '—'}
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{background: color}} />
                <span className="text-sm font-semibold" style={{color}}>
                  {score !== null ? scoreLabel(score) : 'Log your first test'}
                </span>
              </div>
            </div>
          )
        })()}
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
          <div className="space-y-4">
            {/* Welcome card */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
              <div className="h-1 w-full" style={{background:'linear-gradient(90deg,#00E0B0 0%,#0078B8 60%,#005580 100%)'}} />
              <div className="px-5 pt-5 pb-6">
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Welcome to PoolKeep</p>
                <h2 className="text-xl font-bold text-text-primary mb-1" style={{fontFamily:"'Oswald',sans-serif"}}>
                  {pool?.name ?? 'Your Pool'} is ready
                </h2>
                <p className="text-text-muted text-sm mb-5 leading-relaxed">
                  Log your first water test to get your health score and exact treatment plan.
                </p>

                {/* Progress checklist */}
                <div className="space-y-2.5 mb-6">
                  {[
                    { label: 'Create your account', done: true },
                    { label: 'Set up your pool', done: true },
                    { label: 'Log your first water test', done: false },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{background: item.done ? 'rgba(29,184,105,0.12)' : 'rgba(0,120,184,0.10)'}}>
                        {item.done
                          ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1DB869" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          : <span className="text-[10px] font-bold" style={{color:'#0078B8'}}>{i + 1}</span>
                        }
                      </div>
                      <span className="text-sm" style={{color: item.done ? '#8AAABB' : '#1A2E3B', fontWeight: item.done ? 400 : 600, textDecoration: item.done ? 'line-through' : 'none'}}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => router.push('/log')}
                  className="w-full font-bold py-4 rounded-xl text-sm flex items-center justify-center gap-2"
                  style={{background:'#0078B8', color:'white', boxShadow:'0 4px 16px rgba(0,120,184,0.3)'}}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Log My First Test
                </button>
              </div>
            </div>

            {/* What you'll see */}
            <div className="bg-white rounded-2xl px-5 py-4 shadow-sm border border-gray-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3">After your first test you'll see</p>
              <div className="space-y-3">
                {[
                  { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>, title: 'Health score 0–100', desc: 'Instant read on your pool condition' },
                  { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2" strokeLinecap="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>, title: 'Exact chemical doses', desc: 'Calculated for your pool size' },
                  { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2" strokeLinecap="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>, title: 'Step-by-step treatment plan', desc: 'In the right order, with safety tips' },
                ].map((f, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{background:'rgba(0,120,184,0.08)'}}>{f.icon}</div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{f.title}</p>
                      <p className="text-xs text-text-muted">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* ACTION NEEDED — icon cards */}
            {(() => {
              const actionItems = [...lastTest.recommendations.action, ...lastTest.recommendations.monitor]
              // Sort: chlorine (most urgent safety issue) always first
              const chlorineFirst = (x: {param: string}) => x.param === 'chlorine' ? -1 : 0
              actionItems.sort((a, b) => chlorineFirst(a) - chlorineFirst(b))
              const paramMeta: Record<string, { icon: React.ReactElement; bg: string; color: string }> = {
                ph:        { bg:'rgba(124,58,237,0.13)',  color:'#6D28D9', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2h4M10 2v7l-4.5 9.5A1 1 0 0 0 6.4 20h11.2a1 1 0 0 0 .9-1.5L14 9V2"/></svg> },
                chlorine:  { bg:'rgba(229,48,74,0.12)',   color:'#C0102E', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> },
                alkalinity:{ bg:'rgba(0,120,184,0.12)',   color:'#005A8E', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M2 12c.6.5 1.2 1 2.5 1C7 13 7 11 9.5 11s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/></svg> },
                cya:       { bg:'rgba(245,166,35,0.15)',  color:'#B97A00', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg> },
                calcium:   { bg:'rgba(100,116,139,0.12)', color:'#475569', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
                salt:      { bg:'rgba(0,120,184,0.12)',   color:'#005A8E', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2C6 9 4 13 4 16a8 8 0 0 0 16 0c0-3-2-7-8-14z"/></svg> },
              }
              const defaultMeta = { bg:'rgba(245,166,35,0.15)', color:'#B97A00', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> }

              if (actionItems.length === 0) return (
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{background:'rgba(29,184,105,0.12)'}}>
                    <IconCheck size={20} style={{color:'#1DB869'}} />
                  </div>
                  <div>
                    <p className="font-bold text-text-primary text-sm">Your pool looks great</p>
                    <p className="text-text-muted text-xs mt-0.5">All parameters in range — no action needed.</p>
                  </div>
                </div>
              )

              return (
                <div className="mb-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2.5">Action Needed</p>
                  <div className="space-y-2.5">
                    {actionItems.map((rec, i) => {
                      const meta = paramMeta[rec.param as keyof typeof paramMeta] ?? defaultMeta
                      const isMonitor = lastTest.recommendations.monitor.some(m => m.title === rec.title)
                      const isUrgentAction = !isMonitor
                      const borderColor = isUrgentAction ? meta.color : '#D97706'
                      const isCriticalChlorine = rec.param === 'chlorine' && (lastTest.free_chlorine ?? 99) < 0.5

                      // Build display desc with patches for old stored data
                      let displayDesc = rec.desc
                        .replace(/\s*See the treatment plan below[\s\S]*?(?:then shock|add chlorine)\.\s*/g, ' ')
                        .replace(/[Aa]nd aerate afterward\.?/g, 'then aim a return jet at the surface for 2–4 hrs to raise pH naturally.')
                        .replace(/[Aa]erate afterward\.?/g, 'aim a return jet at the surface for 2–4 hrs to raise pH naturally.')
                        .trim()
                      if (rec.param === 'chlorine' && displayDesc.includes('Lower pH to 7.2 first, then add chlorine')) {
                        const ph = lastTest.ph ?? 7.4
                        displayDesc = `Free chlorine at ${lastTest.free_chlorine} ppm — unsafe for swimming. Step 1: add pH reducer to bring pH to 7.2. Step 2: shock the pool. At pH ${ph}, most of the shock is ineffective — lower it first and the same dose works 2–3× better.`
                      }

                      // Split into alert sentence + detail for visual hierarchy
                      const firstDot = displayDesc.search(/[.!?](\s|$)/)
                      const alertLine = firstDot > 0 ? displayDesc.slice(0, firstDot + 1) : displayDesc
                      const detailLine = firstDot > 0 ? displayDesc.slice(firstDot + 1).trim() : ''

                      const displayTitle = rec.param === 'chlorine' && rec.title === 'Lower pH first, then add chlorine'
                        ? 'Chlorine critically low — two steps'
                        : rec.title

                      return (
                        <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                          {/* Urgency left border strip */}
                          <div className="flex">
                            <div className="w-1 shrink-0 rounded-l-2xl" style={{background: borderColor}} />
                            <div className="flex items-start gap-3 px-4 py-3.5 flex-1 min-w-0">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{background: meta.bg, color: meta.color}}>
                                {meta.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                  <p className="font-bold text-text-primary text-sm leading-snug">{displayTitle}</p>
                                  {isCriticalChlorine && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{background:'rgba(220,38,38,0.1)', color:'#DC2626'}}>DO NOT SWIM</span>
                                  )}
                                </div>
                                <p className="text-xs leading-relaxed" style={{color:'#3D5566', fontWeight:500}}>{alertLine}</p>
                                {detailLine ? <p className="text-xs text-text-muted leading-relaxed mt-0.5">{detailLine}</p> : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* Treatment plan — timeline grouped */}
            {lastTest.recommendations.treatment_plan && lastTest.recommendations.treatment_plan.length > 0 ? (
              <>
                <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3">Treatment Plan</p>
                {(() => {
                  const steps = lastTest.recommendations.treatment_plan
                  const WHEN_ORDER = ['today', 'in-1-2-days', 'this-week', 'plan-ahead'] as const
                  const WHEN_LABELS: Record<string, { label: string; sublabel: string; color: string; bg: string }> = {
                    'today':       { label: 'Do Today',     sublabel: 'Start here',              color: '#DC2626', bg: 'rgba(220,38,38,0.07)' },
                    'in-1-2-days': { label: 'In 1–2 Days',  sublabel: 'After first steps settle', color: '#D97706', bg: 'rgba(217,119,6,0.07)'  },
                    'this-week':   { label: 'This Week',    sublabel: 'Once priority steps done', color: '#0078B8', bg: 'rgba(0,120,184,0.06)'  },
                    'plan-ahead':  { label: 'Plan Ahead',   sublabel: 'Not urgent — schedule it', color: '#64748B', bg: 'rgba(100,116,139,0.06)' },
                  }
                  const groups = WHEN_ORDER.map(w => ({
                    when: w,
                    meta: WHEN_LABELS[w],
                    steps: steps.filter(s => (s.when ?? 'today') === w),
                  })).filter(g => g.steps.length > 0)

                  return (
                    <div className="space-y-6 mb-6">
                      {groups.map((group, gi) => (
                        <div key={group.when}>
                          {/* Timeline header */}
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{background: group.meta.color}} />
                            <div className="flex-1">
                              <span className="text-xs font-bold uppercase tracking-widest" style={{color: group.meta.color}}>{group.meta.label}</span>
                              <span className="text-[10px] text-text-faint ml-2">{group.meta.sublabel}</span>
                            </div>
                            {gi < groups.length - 1 && <div className="h-px flex-1 bg-gray-100" />}
                          </div>
                          <div className="space-y-3 pl-5 border-l-2" style={{borderColor: group.meta.color + '30'}}>
                            {group.steps.map(step => {
                              const stepColor = step.step === 1
                                ? '#DC2626' : step.step === 2
                                ? '#EA580C' : '#D97706'
                              const isExpanded = expandedSteps.has(step.step)
                              const toggleExpand = () => setExpandedSteps(prev => {
                                const next = new Set(prev)
                                next.has(step.step) ? next.delete(step.step) : next.add(step.step)
                                return next
                              })
                              // Extract the core action from how — show full sentences, no mid-sentence cuts
                              const paras = step.how.split('\n\n').map((s: string) => s.trim()).filter(Boolean)
                              const lastPara = paras[paras.length - 1].replace(/^Step \d+\s*[—–-]\s*/, '')
                              // Keep up to 220 chars but always end on a complete sentence
                              const actionLine = lastPara.length <= 220 ? lastPara : (() => {
                                const cut = lastPara.slice(0, 220)
                                const lastDot = cut.lastIndexOf('. ')
                                return lastDot > 80 ? cut.slice(0, lastDot + 1) : cut + '…'
                              })()

                              return (
                                <div key={step.step} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                  {/* Compact always-visible header */}
                                  <div className="px-4 pt-3.5 pb-3 flex items-start gap-3">
                                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-bold text-sm text-white mt-0.5" style={{background: stepColor, fontFamily:"'Oswald',sans-serif"}}>
                                      {step.step}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-bold text-text-primary text-sm leading-snug mb-1.5">{step.title}</p>
                                      {step.chemical && (
                                        step.chemical.includes('\n') ? (() => {
                                          // Build sub-step arrays — inject aerate for old stored data when TA was high
                                          const chemLines = (step.chemical ?? '').split('\n')
                                          const amountLines = step.amount ? step.amount.split('\n') : []
                                          const hasJet = chemLines.some((c: string) => c.toLowerCase().includes('jet') || c.toLowerCase().includes('aerate'))
                                          const hasAcidAndChlorine = chemLines.length >= 2
                                            && (chemLines[0].toLowerCase().includes('acid') || chemLines[0].toLowerCase().includes('reducer'))
                                            && (chemLines[1].toLowerCase().includes('chlorine') || chemLines[1].toLowerCase().includes('shock'))
                                          if (!hasJet && hasAcidAndChlorine && (lastTest.total_alkalinity ?? 0) > 140) {
                                            chemLines.push('Aim pool jets at surface')
                                            amountLines.push('Point a return jet toward the water surface — run 2–4 hrs to off-gas CO₂ and raise pH back naturally')
                                          }
                                          return (
                                          // Multi-chemical step — numbered sub-steps
                                          <div className="bg-surface rounded-lg px-2.5 py-2 mb-2 space-y-2.5">
                                            {chemLines.map((chem: string, ci: number) => {
                                              const lineAmount = amountLines[ci] ?? ''
                                              const isAcid = ci === 0 && chemLines.length > 1
                                              const isChlorine = chem.toLowerCase().includes('chlorine') || chem === 'Pool Shock'
                                              const isAerate = chem.toLowerCase().includes('jet') || chem.toLowerCase().includes('aerate')
                                              const stepColor = isAcid ? '#0078B8' : isAerate ? '#00967A' : '#DC2626'
                                              return (
                                                <div key={ci} className="flex items-start gap-2">
                                                  <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold text-white mt-0.5" style={{background: stepColor, minWidth:16}}>{ci + 1}</span>
                                                  <div>
                                                    <p className="text-xs font-bold" style={{color: stepColor}}>{chem}</p>
                                                    {lineAmount && <p className="text-xs font-semibold text-text-muted mt-0.5">{lineAmount}</p>}
                                                    {isAcid && (
                                                      <div className="flex items-center gap-1 mt-1">
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                                        <p className="text-[10px] italic" style={{color:'#0078B8'}}>Wait 30–60 min before adding chlorine</p>
                                                      </div>
                                                    )}
                                                    {isChlorine && (
                                                      <div className="flex items-start gap-1 mt-1">
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#00967A" strokeWidth="2.5" strokeLinecap="round" className="shrink-0 mt-px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                                        <p className="text-[10px] italic" style={{color:'#00967A'}}>Liquid: fades fast in heat &amp; sun — retest in 1–4 hrs, swim when FC &lt; 5 ppm · Granular: retest next morning</p>
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              )
                                            })}
                                          </div>
                                          )
                                        })() : (
                                          // Single chemical
                                          <div className="bg-surface rounded-lg px-2.5 py-2 mb-2">
                                            <div className="flex items-start gap-1.5">
                                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2.2" strokeLinecap="round" className="shrink-0 mt-0.5"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>
                                              <div>
                                                <span className="text-xs font-bold" style={{color:'#0078B8'}}>{step.chemical}</span>
                                                {step.amount && <span className="text-xs font-semibold text-text-muted ml-1">· {step.amount}</span>}
                                              </div>
                                            </div>
                                          </div>
                                        )
                                      )}
                                      <p className="text-xs text-text-muted leading-relaxed">{actionLine}</p>
                                    </div>
                                  </div>

                                  {/* Expand toggle */}
                                  <button
                                    onClick={toggleExpand}
                                    className="w-full flex items-center justify-between px-4 py-2.5 border-t border-gray-50 text-left"
                                    style={{background: isExpanded ? '#F8FBFD' : 'transparent'}}
                                  >
                                    <span className="text-[11px] font-semibold" style={{color:'#0078B8'}}>
                                      {isExpanded ? 'Hide details' : 'Why + full instructions'}
                                    </span>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2.5" strokeLinecap="round" style={{transform: isExpanded ? 'rotate(180deg)' : 'none', transition:'transform 0.2s'}}>
                                      <polyline points="6 9 12 15 18 9"/>
                                    </svg>
                                  </button>

                                  {/* Expandable detail */}
                                  {isExpanded && (
                                    <div className="px-4 pb-4 pt-3 space-y-3 border-t border-gray-50">
                                      <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{color:'#0078B8'}}>Why</p>
                                        <p className="text-xs text-text-muted leading-relaxed">{step.why}</p>
                                      </div>
                                      <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{color:'#0078B8'}}>How to apply</p>
                                        {(() => {
                                          let blocks = step.how.split('\n\n').map((s: string) => s.trim()).filter(Boolean)
                                          if (blocks.length === 1) blocks = step.how.split(/(?=Step \d+\s*[—–-])/).map((s: string) => s.trim()).filter(Boolean)
                                          return (
                                            <div className="space-y-3">
                                              {blocks.map((block: string, idx: number) => {
                                                const m = block.match(/^(Step \d+)\s*[—–-]\s*([\s\S]+)$/)
                                                if (m) return (
                                                  <div key={idx}>
                                                    <p className="text-xs font-bold text-text-primary mb-0.5">{m[1]}</p>
                                                    <p className="text-xs text-text-muted leading-relaxed">{m[2]}</p>
                                                  </div>
                                                )
                                                return <p key={idx} className="text-xs text-text-muted leading-relaxed">{block}</p>
                                              })}
                                            </div>
                                          )
                                        })()}
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
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </>
            ) : null}

            {/* Ongoing maintenance guide */}
            {lastTest.recommendations.maintenance && lastTest.recommendations.maintenance.length > 0 && (
              <>
                <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3">Your Pool — Ongoing Guide</p>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
                  {lastTest.recommendations.maintenance.map((tip, i) => {
                    const icons = {
                      testing:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2" strokeLinecap="round"><path d="M9 3v11l-3 3h12l-3-3V3"/><line x1="9" y1="3" x2="15" y2="3"/></svg>,
                      chlorine: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2" strokeLinecap="round"><path d="M12 2C6 9 4 13 4 16a8 8 0 0 0 16 0c0-3-2-7-8-14z"/></svg>,
                      shock:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
                      brushing: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/></svg>,
                      seasonal: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
                      filter:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>,
                    }
                    return (
                      <div key={i} className={`px-4 py-3.5 flex items-start gap-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{background:'#F0F6FA'}}>
                          {icons[tip.category as keyof typeof icons]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-text-primary mb-0.5">{tip.title}</p>
                          <p className="text-[11px] text-text-muted leading-relaxed">{tip.body}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Looking good */}
            {(() => {
              // Filter out pH from 'good' when FC is critically low and pH > 7.2 —
              // in that scenario pH needs to be lowered before shocking, not celebrated.
              const phNeedsShockPrep = (lastTest.free_chlorine ?? 99) < 0.5 && (lastTest.ph ?? 0) > 7.2
              const goodItems = lastTest.recommendations.good.filter(g => !(g.param === 'ph' && phNeedsShockPrep))
              return goodItems.length > 0 ? (
              <div className="mb-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2.5">Looking Good</p>
                <div className="space-y-2">
                  {goodItems.map((a, i) => (
                    <div key={i} className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{background:'rgba(29,184,105,0.12)'}}>
                        <IconCheck size={15} style={{color:'#1DB869'}} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-text-primary">{a.title}</p>
                        <p className="text-xs text-text-muted mt-0.5">{a.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              ) : null
            })()}

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

        {/* Reminder settings */}
        <div className="bg-white rounded-2xl px-4 py-4 shadow-sm border border-gray-100 mt-4 mb-2">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{background:'rgba(0,120,184,0.08)'}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </div>
            <div>
              <p className="text-sm font-bold text-text-primary">Test Reminders</p>
              <p className="text-xs text-text-muted">Email me if I forget to test</p>
            </div>
          </div>
          <div className="flex gap-2">
            {([null, 3, 7, 14] as (number | null)[]).map(days => (
              <button
                key={days ?? 'off'}
                onClick={() => saveReminderDays(days)}
                disabled={savingReminder}
                className="flex-1 py-2 text-xs font-bold rounded-xl transition-all"
                style={remindDays === days
                  ? {background:'#0078B8', color:'white'}
                  : {background:'#F0F6FA', color:'#8AAABB'}}
              >
                {days === null ? 'Off' : `${days}d`}
              </button>
            ))}
          </div>
          {remindDays !== null && (
            <p className="text-[10px] text-text-faint mt-2 text-center">
              You&apos;ll get an email if {pool?.name ?? 'your pool'} goes {remindDays} days without a test
            </p>
          )}
        </div>
      </div>

      {/* Success toast */}
      {showToast && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 px-4 py-3 rounded-2xl shadow-lg flex items-center gap-2.5 text-sm font-semibold text-white transition-all"
          style={{background:'#1DB869', maxWidth: 320, width:'calc(100% - 32px)'}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Test logged — your score is updated
        </div>
      )}

      {/* Bottom tab bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-2">
        <div className="flex items-center justify-around py-2 max-w-md mx-auto">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: <IconDashboard /> },
            { id: 'history', label: 'History', icon: <IconHistory /> },
            { id: 'log', label: '', icon: null },
            { id: 'share', label: 'Share', icon: <IconShare /> },
            { id: 'pro', label: 'Account', icon: <IconPro /> },
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

