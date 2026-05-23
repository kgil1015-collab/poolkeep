'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

import type { TreatmentStep } from '@/lib/recommendations'

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
    unknown: { title: string; desc: string; tags: string[] }[]
    action: { title: string; desc: string; tags: string[] }[]
    monitor: { title: string; desc: string; tags: string[] }[]
    good: { title: string; desc: string }[]
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

        {/* Health score ring */}
        {(() => {
          const score = lastTest?.health_score ?? null
          const { color } = statusAccent(score)
          const R = 50, CX = 60, CY = 60, SW = 9
          const C = 2 * Math.PI * R
          const arcLen = (270 / 360) * C
          const fillLen = score !== null ? (score / 100) * arcLen : 0
          return (
            <div className="flex flex-col items-center pb-4 relative">
              <div className="relative" style={{width:130,height:130}}>
                <svg width="130" height="130" viewBox="0 0 120 120">
                  <circle cx={CX} cy={CY} r={R} fill="none"
                    stroke="rgba(255,255,255,0.1)" strokeWidth={SW} strokeLinecap="round"
                    strokeDasharray={`${arcLen} ${C - arcLen}`}
                    transform={`rotate(-225 ${CX} ${CY})`}
                  />
                  {score !== null && (
                    <circle cx={CX} cy={CY} r={R} fill="none"
                      stroke={color} strokeWidth={SW} strokeLinecap="round"
                      strokeDasharray={`${fillLen} ${C - fillLen}`}
                      transform={`rotate(-225 ${CX} ${CY})`}
                    />
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-white font-bold leading-none" style={{fontSize:38,fontFamily:"'Oswald',sans-serif"}}>
                    {score ?? '—'}
                  </p>
                  <p className="text-white/40 text-[9px] font-bold uppercase tracking-widest mt-0.5">Score</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 -mt-1">
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
            {/* Pinned next step */}
            {(() => {
              const plan = lastTest.recommendations.treatment_plan
              const firstStep = plan?.[0]
              const allGood = lastTest.recommendations.action.length === 0 && lastTest.recommendations.monitor.length === 0
              if (allGood) return (
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{background:'rgba(29,184,105,0.1)'}}>
                    <IconCheck size={22} style={{color:'#1DB869'}} />
                  </div>
                  <div>
                    <p className="font-bold text-text-primary">Your pool looks great</p>
                    <p className="text-text-muted text-xs mt-0.5">All parameters in range — no action needed.</p>
                  </div>
                </div>
              )
              if (!firstStep) return null
              const u = firstStep.urgency === 'urgent'
                ? { badge:'#E5304A', bg:'rgba(229,48,74,0.07)', border:'rgba(229,48,74,0.18)', label:'Urgent' }
                : firstStep.urgency === 'soon'
                ? { badge:'#D48800', bg:'rgba(245,166,35,0.07)', border:'rgba(245,166,35,0.2)', label:'Soon' }
                : { badge:'#0078B8', bg:'rgba(0,120,184,0.06)', border:'rgba(0,120,184,0.14)', label:'Routine' }
              return (
                <div className="rounded-2xl px-4 py-3.5 shadow-sm border mb-4" style={{background:u.bg, borderColor:u.border}}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full text-white" style={{background:u.badge}}>Next Step</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{color:u.badge}}>{u.label}</span>
                  </div>
                  <p className="font-bold text-text-primary text-sm leading-snug">{firstStep.title}</p>
                  {firstStep.chemical && firstStep.amount && (
                    <div className="flex items-center gap-1.5 mt-2 bg-white/60 rounded-lg px-2.5 py-1.5 self-start inline-flex">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={u.badge} strokeWidth="2.2" strokeLinecap="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>
                      <span className="text-xs font-bold" style={{color:u.badge}}>{firstStep.chemical}</span>
                      <span className="text-xs text-text-muted">· {firstStep.amount}</span>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Parameter sections */}
            {(() => {
              type ParamGroup = { p: typeof PARAM_RANGES[0]; val: number; pct: number; idealLeftPct: number; idealWidthPct: number; dotColor: string; valueColor: string; borderColor: string; bgColor: string }
              const actionParams: ParamGroup[] = []
              const monitorParams: ParamGroup[] = []
              const goodParams: ParamGroup[] = []
              const notTestedLabels: string[] = []

              PARAM_RANGES.forEach(p => {
                const raw = lastTest[p.key as keyof TestResult]
                const val = typeof raw === 'number' ? raw : null
                if (val === null) { notTestedLabels.push(p.label); return }
                const pct = Math.max(0, Math.min(100, ((val - p.viewMin) / (p.viewMax - p.viewMin)) * 100))
                const idealLeftPct = Math.max(0, ((p.idealMin - p.viewMin) / (p.viewMax - p.viewMin)) * 100)
                const idealWidthPct = Math.min(100 - idealLeftPct, ((p.idealMax - p.idealMin) / (p.viewMax - p.viewMin)) * 100)
                const isAction = lastTest.recommendations.action.some(r => r.title.toLowerCase().includes(p.label.toLowerCase()))
                const isMonitor = !isAction && lastTest.recommendations.monitor.some(r => r.title.toLowerCase().includes(p.label.toLowerCase()))
                if (isAction) {
                  actionParams.push({ p, val, pct, idealLeftPct, idealWidthPct, dotColor: '#E5304A', valueColor: '#E5304A', borderColor: '#E5304A', bgColor: 'rgba(229,48,74,0.04)' })
                } else if (isMonitor) {
                  monitorParams.push({ p, val, pct, idealLeftPct, idealWidthPct, dotColor: '#D48800', valueColor: '#D48800', borderColor: '#F5A623', bgColor: 'rgba(245,166,35,0.04)' })
                } else {
                  goodParams.push({ p, val, pct, idealLeftPct, idealWidthPct, dotColor: '#1DB869', valueColor: '#0078B8', borderColor: '#00CCA3', bgColor: 'rgba(29,184,105,0.04)' })
                }
              })

              const needsAttention = [...actionParams, ...monitorParams]

              const renderBar = (g: ParamGroup) => (
                <div key={g.p.key} className="rounded-xl px-4 py-3 shadow-sm border-l-4 overflow-hidden" style={{background:g.bgColor, borderLeftColor:g.borderColor, boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{background:g.dotColor}} />
                      <span className="text-xs font-bold uppercase tracking-wide text-text-muted">{g.p.label}</span>
                    </div>
                    <span className="text-sm font-bold" style={{fontFamily:"'DM Mono',monospace",color:g.valueColor}}>
                      {g.p.fmt(g.val)}{g.p.unit ? ` ${g.p.unit}` : ''}
                    </span>
                  </div>
                  <div className="relative h-1.5 rounded-full overflow-hidden" style={{background:'#EEF5FA'}}>
                    <div className="absolute top-0 bottom-0 rounded-full" style={{left:`${g.idealLeftPct}%`,width:`${g.idealWidthPct}%`,background:'rgba(29,184,105,0.22)'}} />
                    <div className="absolute top-0 bottom-0 rounded-full" style={{left:`${g.pct}%`,width:3,background:g.dotColor,transform:'translateX(-50%)'}} />
                  </div>
                  <p className="text-[9px] text-text-faint mt-1">Ideal {g.p.idealMin}{g.p.unit ? ` ${g.p.unit}` : ''} – {g.p.idealMax}{g.p.unit ? ` ${g.p.unit}` : ''}</p>
                </div>
              )

              return (
                <div className="space-y-4 mb-5">
                  {needsAttention.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full" style={{background:'rgba(245,166,35,0.12)',color:'#D48800'}}>⚠ Needs Attention</span>
                      </div>
                      <div className="space-y-2">{needsAttention.map(renderBar)}</div>
                    </div>
                  )}
                  {goodParams.length > 0 && (
                    <div>
                      {needsAttention.length > 0 && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full" style={{background:'rgba(0,204,163,0.12)',color:'#009E7E'}}>✓ Looking Good</span>
                        </div>
                      )}
                      <div className="space-y-2">{goodParams.map(renderBar)}</div>
                    </div>
                  )}
                </div>
              )
            })()}

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
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{color:'#0078B8'}}>How to apply</p>
                            {(() => {
                              // Split on \n\n paragraphs first; if that yields only one block,
                              // also split on "Step N —" boundaries so old stored results work too
                              let blocks = step.how.split('\n\n').map(s => s.trim()).filter(Boolean)
                              if (blocks.length === 1) {
                                blocks = step.how.split(/(?=Step \d+\s*[—–-])/).map(s => s.trim()).filter(Boolean)
                              }
                              return (
                                <div className="space-y-3">
                                  {blocks.map((block, idx) => {
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
                      </div>
                    )
                  })}
                </div>
              </>
            ) : null}

            {/* Looking good — with descriptions */}
            {lastTest.recommendations.good.length > 0 && (
              <div className="mb-5">
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
