'use client'

import React, { useEffect, useState } from 'react'
import WaveDivider from '@/app/components/WaveDivider'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

import type { TreatmentStep, MaintenanceTip, TestInput } from '@/lib/recommendations'
import { calculateRecommendations } from '@/lib/recommendations'

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
  // Compare local calendar dates, not elapsed hours
  const dDay   = new Date(d.getFullYear(),   d.getMonth(),   d.getDate())
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const calDiff = Math.round((nowDay.getTime() - dDay.getTime()) / 86400000)
  if (calDiff === 0) return `Today at ${timeStr}`
  if (calDiff === 1) return `Yesterday at ${timeStr}`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` at ${timeStr}`
}

function scoreLabel(score: number) {
  if (score >= 90) return 'Excellent condition'
  if (score >= 82) return 'Good condition'
  if (score >= 68) return 'A few things to watch'
  if (score >= 50) return 'Needs attention'
  return 'Action required'
}

// Compute score from stored recommendations so it always reflects the current
// formula, even for tests logged before the formula was updated.
function computeScore(recs: TestResult['recommendations']): number {
  const actionCount = recs.action.length
  const monitorCount = recs.monitor.length
  const unknownCount = recs.unknown.filter(u => u.param !== 'salt').length
  return Math.max(10, 100 - actionCount * 18 - monitorCount * 6 - unknownCount * 8)
}

function statusAccent(score: number | null) {
  if (score === null) return { color: '#3AB5E6', overlay: 'none', glow: 'rgba(58,181,230,0.25)' }
  if (score >= 90) return { color: '#29B8E8', overlay: 'radial-gradient(ellipse at 50% 80%, rgba(41,184,232,0.18) 0%, transparent 65%)', glow: 'rgba(41,184,232,0.40)' }
  if (score >= 75) return { color: '#29B8E8', overlay: 'radial-gradient(ellipse at 50% 80%, rgba(41,184,232,0.15) 0%, transparent 65%)', glow: 'rgba(41,184,232,0.40)' }
  if (score >= 55) return { color: '#5BC8F5', overlay: 'radial-gradient(ellipse at 50% 80%, rgba(91,200,245,0.15) 0%, transparent 65%)', glow: 'rgba(91,200,245,0.35)' }
  return { color: '#A8D8EA', overlay: 'radial-gradient(ellipse at 50% 80%, rgba(168,216,234,0.15) 0%, transparent 65%)', glow: 'rgba(168,216,234,0.30)' }
}

function getWelcome(firstName: string, lastTest: TestResult | null) {
  const hour = new Date().getHours()
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  if (!lastTest) return {
    salutation: `Welcome, ${firstName}! 👋`,
    headline: "Let's get your pool crystal clear",
    subline: 'Log your first test to get a health score and treatment plan',
    urgency: 0,
  }

  const testDate   = new Date(lastTest.created_at)
  const hoursSince = Math.floor((Date.now() - testDate.getTime()) / 3600000)
  // Use local calendar days, not elapsed hours, so a test at 11pm last night
  // correctly shows as "yesterday" the next morning
  const now2       = new Date()
  const testDay    = new Date(testDate.getFullYear(), testDate.getMonth(), testDate.getDate())
  const todayDay   = new Date(now2.getFullYear(),     now2.getMonth(),     now2.getDate())
  const daysSince  = Math.round((todayDay.getTime() - testDay.getTime()) / 86400000)

  if (hoursSince < 6) return {
    salutation: `${timeGreeting}, ${firstName}!`,
    headline: 'Fresh test logged ✓',
    subline: 'Your pool is all set — check back in a day or two',
    urgency: 0,
  }
  if (daysSince === 0) {
    // Exclude calcium — it's shown in the Water Report only, not in action cards
    const hasActions   = lastTest.recommendations.action.filter(r => r.param !== 'calcium').length > 0
    const monitorCount = lastTest.recommendations.monitor.filter(r => r.param !== 'calcium').length
    if (hasActions) return {
      salutation: `${timeGreeting}, ${firstName}!`,
      headline: 'Pool needs attention today',
      subline: 'Your latest test flagged some items — check the treatment plan below.',
      urgency: 1,
    }
    if (monitorCount >= 2) return {
      salutation: `${timeGreeting}, ${firstName}!`,
      headline: 'A few things to keep an eye on',
      subline: `${monitorCount} parameters are slightly off — nothing urgent, but worth monitoring this week.`,
      urgency: 0,
    }
    if (monitorCount === 1) return {
      salutation: `${timeGreeting}, ${firstName}!`,
      headline: 'Pool looking good',
      subline: 'One parameter to watch — see the water report below.',
      urgency: 0,
    }
    return {
      salutation: `${timeGreeting}, ${firstName}!`,
      headline: 'Pool looking great',
      subline: 'Tested today — everything in range. Keep up the great work.',
      urgency: 0,
    }
  }
  if (daysSince === 1) {
    const hasActions = lastTest.recommendations.action.filter(r => r.param !== 'calcium').length > 0
    if (hasActions) return {
      salutation: `${timeGreeting}, ${firstName}!`,
      headline: "Your pool still needs attention",
      subline: "Yesterday's test flagged some items — work through the treatment plan to get back on track.",
      urgency: 1,
    }
    return {
      salutation: `${timeGreeting}, ${firstName}!`,
      headline: 'Nothing to do today',
      subline: 'Tested yesterday — your pool is stable. See you in a day or two 👋',
      urgency: 0,
    }
  }
  if (daysSince <= 3) return {
    salutation: `Hey ${firstName}, welcome back!`,
    headline: 'Ready to log another test?',
    subline: `Last tested ${daysSince} days ago — your pool is on track`,
    urgency: 1,
  }
  if (daysSince <= 7) return {
    salutation: `Hey ${firstName}!`,
    headline: 'Time for a quick check',
    subline: `It's been ${daysSince} days — a fast test keeps your chemistry balanced`,
    urgency: 2,
  }
  return {
    salutation: `Hey ${firstName}!`,
    headline: 'Your pool needs a test',
    subline: `${daysSince} days since your last reading — chemistry can shift fast`,
    urgency: 3,
  }
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
  const [pool, setPool] = useState<{ id: string; name: string; remind_after_days: number | null; volume_gallons: number; type: string } | null>(null)
  const [allPools, setAllPools] = useState<{ id: string; name: string; remind_after_days: number | null; volume_gallons: number; type: string }[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [isPro, setIsPro] = useState(false)
  const [lastTest, setLastTest] = useState<TestResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [remindDays, setRemindDays] = useState<number | null>(null)
  const [savingReminder, setSavingReminder] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [showUpgradeToast, setShowUpgradeToast] = useState(false)
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set())
  // Animated score for the water-fill health indicator (0 → actual score)
  const [displayScore, setDisplayScore] = useState(0)
  // Live-recalculated recommendations using current pool volume/type
  const [liveRecs, setLiveRecs] = useState<TestResult['recommendations'] | null>(null)

  useEffect(() => {
    if (sessionStorage.getItem('poolkeep_just_logged')) {
      sessionStorage.removeItem('poolkeep_just_logged')
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3000)
    }
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('upgraded') === '1') {
      setShowUpgradeToast(true)
      setTimeout(() => setShowUpgradeToast(false), 5000)
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUser(data.user as User)
      const [{ data: profile }, { data: pools }] = await Promise.all([
        supabase.from('profiles').select('subscription_status').eq('id', data.user.id).maybeSingle(),
        supabase.from('pools').select('id,name,remind_after_days,volume_gallons,type').order('created_at', { ascending: true }),
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

  // Recalculate recommendations live whenever pool settings or test data changes
  // This ensures chemical doses always reflect the current pool volume + type,
  // even if the pool was edited after the test was logged.
  useEffect(() => {
    if (!lastTest || !pool) { setLiveRecs(null); return }
    const testInput: TestInput = {
      ph: lastTest.ph,
      free_chlorine: lastTest.free_chlorine,
      total_alkalinity: lastTest.total_alkalinity,
      cya: lastTest.cya,
      calcium_hardness: lastTest.calcium_hardness,
      salt: lastTest.salt,
    }
    const result = calculateRecommendations(testInput, pool.volume_gallons, pool.type)
    setLiveRecs(result as TestResult['recommendations'])
  }, [lastTest, pool])

  // Animate water level rising whenever the test result changes
  useEffect(() => {
    if (!lastTest) { setDisplayScore(0); return }
    const recs = liveRecs ?? lastTest.recommendations
    const score = computeScore(recs)
    setDisplayScore(0)
    const t = setTimeout(() => setDisplayScore(score), 120)
    return () => clearTimeout(t)
  }, [lastTest, liveRecs])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  async function switchPool(p: { id: string; name: string; remind_after_days: number | null; volume_gallons: number; type: string }) {
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
        <WaveDivider />
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
  const welcome = getWelcome(firstName, lastTest)

  return (
    <div className="min-h-screen bg-surface flex flex-col" style={{maxWidth:480,margin:'0 auto'}}>

      {/* Header */}
      <div className="bg-pool-deep px-5 pt-5 pb-6 relative overflow-hidden">
        {/* Dynamic status overlay */}
        {lastTest && (
          <div className="absolute inset-0 pointer-events-none" style={{background: statusAccent(computeScore((liveRecs ?? lastTest.recommendations))).overlay}} />
        )}
        {/* Light-through-water shimmer */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.06) 50%, transparent 65%)',
            animation: 'headerShimmer 9s ease-in-out infinite',
          }}
        />
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

        <p className="text-white/70 text-sm mb-0.5">{welcome.salutation}</p>
        <h1 className="text-white text-2xl font-bold mb-1" style={{fontFamily:"'Oswald',sans-serif",letterSpacing:'-.01em'}}>{welcome.headline}</h1>
        <p className="text-white/65 text-sm mb-4 leading-snug">{welcome.subline}</p>

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
                onClick={() => { setShowPicker(false); router.push('/pool/edit') }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface transition-colors border-t border-gray-50"
              >
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{background:'rgba(0,120,184,0.1)'}}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </div>
                <span className="text-sm font-medium" style={{color:'#0078B8'}}>Edit Pool</span>
              </button>
              <button
                onClick={() => { setShowPicker(false); router.push(isPro || allPools.length === 0 ? '/setup/pool' : '/pro') }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface transition-colors border-t border-gray-50"
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

        {/* Health score — water fill: rises from bottom like a pool */}
        {(() => {
          const score = lastTest ? computeScore((liveRecs ?? lastTest.recommendations)) : null
          const { color, glow } = statusAccent(score)
          const unknownCount = lastTest
            ? (liveRecs ?? lastTest.recommendations).unknown.filter(u => u.param !== 'salt').length
            : 0
          const testedCount = 5 - unknownCount

          // Water fill geometry: circle cx=80 cy=80 r=58 → spans y 22→138 (dia=116)
          // translateY shifts the water block down; CSS transition makes it rise
          const fillH = score !== null ? Math.round(116 * displayScore / 100) : 0
          const offsetY = 116 - fillH

          // Colour shifts teal when pool is excellent
          const excellent = score !== null && score >= 90
          const waterDeep = excellent ? 'rgba(0,90,160,0.55)' : 'rgba(0,80,150,0.50)'
          const waveFront = excellent ? 'rgba(0,190,255,0.75)' : 'rgba(0,168,240,0.72)'
          const waveBack  = excellent ? 'rgba(0,150,220,0.45)' : 'rgba(0,140,210,0.42)'

          return (
            <div className="flex flex-col items-center pb-5">
              <p className="text-white/70 text-[11px] font-bold uppercase tracking-widest mb-3">Health Score</p>
              <div className="relative flex items-center justify-center" style={{width:160, height:160}}>
                <svg width="160" height="160" viewBox="0 0 160 160" style={{position:'absolute',top:0,left:0}}>
                  <defs>
                    <clipPath id="scoreCircleClip">
                      <circle cx="80" cy="80" r="58"/>
                    </clipPath>
                  </defs>

                  {/* Outer glow ring */}
                  <circle cx="80" cy="80" r="62" fill="none" stroke="rgba(0,160,230,0.18)" strokeWidth="8"/>
                  {/* Dark navy pool base */}
                  <circle cx="80" cy="80" r="59" fill="rgba(0,20,45,0.85)" stroke="rgba(0,170,240,0.65)" strokeWidth="3"/>

                  {/* Water fill — all clipped to circle */}
                  {score !== null && (
                    <g clipPath="url(#scoreCircleClip)">
                      {/* Bulk water — rises from bottom */}
                      <rect x="22" y="22" width="116" height="116" fill={waterDeep}
                        style={{transform:`translateY(${offsetY}px)`, transition:'transform 1.5s cubic-bezier(0.4,0,0.2,1)'}}
                      />
                      {/* Wave surface — front layer, scrolls left */}
                      <g style={{transform:`translateY(${offsetY}px)`, transition:'transform 1.5s cubic-bezier(0.4,0,0.2,1)'}}>
                        <path
                          d="M-92,20 Q-64,13 -36,20 Q-8,27 20,20 Q48,13 76,20 Q104,27 132,20 Q160,13 188,20 Q216,27 244,20 Q272,13 300,20 L300,33 L-92,33 Z"
                          fill={waveFront}
                          style={{animation:'waveSurface 3s linear infinite'}}
                        />
                      </g>
                      {/* Wave surface — back layer, scrolls right */}
                      <g style={{transform:`translateY(${offsetY + 5}px)`, transition:'transform 1.5s cubic-bezier(0.4,0,0.2,1)'}}>
                        <path
                          d="M-92,20 Q-64,27 -36,20 Q-8,13 20,20 Q48,27 76,20 Q104,13 132,20 Q160,27 188,20 Q216,13 244,20 L244,33 L-92,33 Z"
                          fill={waveBack}
                          style={{animation:'waveSurface 4.5s linear infinite reverse'}}
                        />
                      </g>
                    </g>
                  )}

                  {/* Rim ring — drawn on top so it always looks crisp */}
                  <circle cx="80" cy="80" r="59" fill="none" stroke="rgba(0,170,240,0.65)" strokeWidth="3"/>
                </svg>

                {/* Score number floats above the water */}
                <div className="relative z-10 flex flex-col items-center">
                  <p
                    key={score}
                    className="text-white font-bold leading-none"
                    style={{
                      fontSize:80, fontFamily:"'Oswald',sans-serif", letterSpacing:'-3px',
                      textShadow:'0 2px 20px rgba(0,0,0,0.6)',
                      animation: score !== null ? 'scoreSpring 0.75s cubic-bezier(0.34,1.56,0.64,1) forwards' : 'none',
                    }}
                  >
                    {score ?? '—'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <div className="w-2.5 h-2.5 rounded-full" style={{background: color, boxShadow:`0 0 8px ${glow}, 0 0 16px ${glow}`}} />
                <span className="text-base font-bold" style={{color, textShadow:`0 0 20px ${glow}`}}>
                  {score !== null ? scoreLabel(score) : 'Log your first test'}
                </span>
              </div>
              {unknownCount > 0 && score !== null && (
                <button onClick={() => router.push('/log')} className="text-center mt-2 px-6 leading-snug hover:opacity-90 transition-opacity">
                  <span className="text-xs" style={{color:'rgba(255,255,255,0.55)'}}>
                    Based on {testedCount} of 5 parameters —{' '}
                    <span style={{color:'#00E0B0', textDecoration:'underline', textUnderlineOffset:3}}>tap to log more →</span>
                  </span>
                </button>
              )}
              {welcome.urgency >= 2 && (
                <button
                  onClick={() => router.push('/log')}
                  className="mt-4 px-7 py-3 rounded-full font-bold text-sm flex items-center gap-2 hover:opacity-90 transition-opacity"
                  style={{background:'rgba(255,255,255,0.15)', color:'white', border:'1.5px solid rgba(255,255,255,0.3)', backdropFilter:'blur(4px)'}}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Log a Test Now
                </button>
              )}
            </div>
          )
        })()}
      </div>

      {/* Wave transition */}
      <WaveDivider />

      {/* Content */}
      <div className="flex-1 px-4 pt-3 pb-24 bg-surface">
        {!lastTest ? (
          <div className="space-y-4">
            {/* Welcome card */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-md border border-gray-200">
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
            <div className="bg-white rounded-2xl px-5 py-4 shadow-md border border-gray-200">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3">After your first test you'll see</p>
              <div className="space-y-3">
                {[
                  { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>, title: 'Health score 0–100', desc: 'Instant read on your pool condition' },
                  { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2" strokeLinecap="round"><path d="M9 3H5a2 2 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>, title: 'Exact chemical doses', desc: 'Calculated for your pool size' },
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

            {/* How to test your water */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-md border border-gray-200">
              <div className="h-1 w-full" style={{background:'linear-gradient(90deg,#0078B8,#00E0B0)'}} />
              <div className="px-5 pt-4 pb-5">
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
                  <div style={{width:3,height:16,background:'#00CCA3',borderRadius:2,flexShrink:0}} />
                  <p style={{fontSize:11,fontWeight:700,letterSpacing:'0.12em',color:'#2A5570',textTransform:'uppercase',fontFamily:"'Space Grotesk',sans-serif"}}>How to Test Your Water</p>
                </div>

                <div className="space-y-5">

                  {/* Step 1 — Collect the sample */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{background:'rgba(0,120,184,0.09)'}}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2C6 9 4 13 4 16a8 8 0 0 0 16 0c0-3-2-7-8-14z"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-text-primary mb-1">Collect the sample correctly</p>
                      <p className="text-xs text-text-muted leading-relaxed">Use a clean cup or small container. Reach your arm elbow-deep (about 12–18 inches) with your hand facing away from the return jets, and fill the cup at that depth. Then bring it up and dip your test strip into the cup — this gives you a controlled, consistent sample every time and makes reading the strip much easier than balancing at the pool edge.</p>
                      <div className="mt-2 px-3 py-2 rounded-xl flex items-start gap-2" style={{background:'rgba(0,120,184,0.05)',border:'1px solid rgba(0,120,184,0.12)'}}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#4A7A9A" strokeWidth="2.2" strokeLinecap="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <p className="text-[11px] leading-snug" style={{color:'#4A7A9A'}}>Avoid sampling near the skimmer, jets, or the water surface — those spots are not representative of the pool overall. And test in the morning before the sun has been on the water long, when chlorine reads most accurately.</p>
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-gray-50" />

                  {/* Step 2 — Use the strip */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{background:'rgba(0,150,122,0.09)'}}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00967A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 3v11l-3 3h12l-3-3V3"/><line x1="9" y1="3" x2="15" y2="3"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-text-primary mb-1">How to use a test strip</p>
                      <ol className="space-y-1.5">
                        {[
                          'Dip the strip in the water for 2 seconds — no swirling.',
                          'Remove it and hold it level (pad-side up). Do not shake off the water.',
                          'Wait exactly 15 seconds before reading — not less, not more.',
                          'Compare each pad to the color chart in good natural light. Artificial light shifts the colors.',
                          'Read from bottom to top of the strip — pH last, since it bleeds into adjacent pads.',
                        ].map((s, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold text-white mt-0.5" style={{background:'#00967A',minWidth:16}}>{i+1}</span>
                            <p className="text-xs text-text-muted leading-relaxed">{s}</p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>

                  <div className="h-px bg-gray-50" />

                  {/* Step 3 — Preferred strips */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{background:'rgba(217,119,6,0.09)'}}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-text-primary mb-1">Recommended test strips</p>
                      <p className="text-xs text-text-muted leading-relaxed mb-2.5">Not all strips are equal. The ones below test 6–7 parameters and have consistent dye chemistry that holds up in heat and humidity.</p>
                      <div className="space-y-2">
                        {[
                          { name: 'AquaChek Select 7-in-1', note: 'Best overall — tests FC, TC, pH, TA, CH, CYA, and bromine. Color-coded pads are easy to read.' },
                          { name: 'HTH 6-Way Test Strips', note: 'Widely available at Walmart and Home Depot. Reliable for the basics and a solid everyday choice.' },
                          { name: 'Taylor TechniStrip', note: 'Professional-grade. Better dye stability in high heat — a good pick for Arizona summers.' },
                        ].map((strip, i) => (
                          <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl" style={{background:'#F8FBFD',border:'1px solid #E0EBF3'}}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00967A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><polyline points="20 6 9 17 4 12"/></svg>
                            <div>
                              <p className="text-xs font-bold" style={{color:'#1A3A4A'}}>{strip.name}</p>
                              <p className="text-[11px] text-text-muted leading-snug mt-0.5">{strip.note}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 px-3 py-2 rounded-xl flex items-start gap-2" style={{background:'rgba(245,166,35,0.07)',border:'1px solid rgba(217,119,6,0.15)'}}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.2" strokeLinecap="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <p className="text-[11px] leading-snug" style={{color:'#92600A'}}>CYA (cyanuric acid) cannot be accurately measured by any test strip — the turbidity-method drop test is required. For all other parameters, fresh strips stored away from heat and humidity give reliable results.</p>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* ACTION NEEDED — icon cards */}
            {(() => {
              const actionItems = [...(liveRecs ?? lastTest.recommendations).action, ...(liveRecs ?? lastTest.recommendations).monitor]
                .filter(rec => rec.param !== 'calcium') // calcium shown in Water Report instead
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

              if (actionItems.length === 0) {
                const unknownNonSalt = (liveRecs ?? lastTest.recommendations).unknown.filter(u => u.param !== 'salt').length
                const hasUnknowns = unknownNonSalt > 0
                const testedBars = 5 - unknownNonSalt
                return (
                  <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-200 flex items-start gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{background: hasUnknowns ? 'rgba(0,150,122,0.10)' : 'rgba(29,184,105,0.12)'}}>
                      {hasUnknowns
                        ? (
                          <svg width="20" height="18" viewBox="0 0 20 18" fill="none">
                            {[0,1,2,3,4].map(i => (
                              <rect key={i} x={i * 4.2} y={i < testedBars ? 18 - (6 + i * 2.5) : 13} width="3" height={i < testedBars ? 6 + i * 2.5 : 5} rx="1"
                                fill={i < testedBars ? '#00967A' : '#D1E8E2'} />
                            ))}
                          </svg>
                        )
                        : <IconCheck size={20} style={{color:'#1DB869'}} />
                      }
                    </div>
                    <div>
                      <p className="font-bold text-text-primary text-sm">
                        {hasUnknowns ? 'Tested parameters look good' : 'Your pool looks great'}
                      </p>
                      <p className="text-text-muted text-xs mt-0.5">
                        {hasUnknowns
                          ? 'No issues found in what you tested — log the remaining parameters for a complete health score.'
                          : 'All parameters in range — no action needed.'}
                      </p>
                    </div>
                  </div>
                )
              }

              return (
                <div className="mb-5">
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                    <div style={{width:14,height:1.5,background:'#00CCA3',borderRadius:2,flexShrink:0}} />
                    <p style={{fontSize:10,fontWeight:500,letterSpacing:'0.16em',color:'#6A9AB0',textTransform:'uppercase',fontFamily:"'Space Grotesk',sans-serif"}}>What Needs Attention</p>
                  </div>
                  <div className="space-y-2.5">
                    {actionItems.map((rec, i) => {
                      const meta = paramMeta[rec.param as keyof typeof paramMeta] ?? defaultMeta
                      const isMonitor = (liveRecs ?? lastTest.recommendations).monitor.some(m => m.title === rec.title)
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
                        displayDesc = `Free chlorine at ${lastTest.free_chlorine} ppm — unsafe for swimming. Step 1: add muriatic acid to bring pH to 7.2. Step 2: shock the pool. At pH ${ph}, most of the shock is ineffective — lower it first and the same dose works 2–3× better.`
                      }

                      // Split into alert sentence + detail for visual hierarchy
                      const firstDot = displayDesc.search(/[.!?](\s|$)/)
                      const alertLine = firstDot > 0 ? displayDesc.slice(0, firstDot + 1) : displayDesc
                      const detailLine = firstDot > 0 ? displayDesc.slice(firstDot + 1).trim() : ''

                      const displayTitle = rec.param === 'chlorine' && rec.title === 'Lower pH first, then add chlorine'
                        ? 'Chlorine critically low — two steps'
                        : rec.title

                      return (
                        <div key={i} className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
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

            {/* ── WATER REPORT ────────────────────────────────────────────── */}
            {(() => {
              const t = lastTest
              // Display ranges zoomed so the ideal zone occupies the center third —
              // a reading at the high end of ideal appears right-of-center,
              // low end appears left-of-center, outside ideal is clearly past the zone.
              const REPORT_PARAMS = [
                { key:'ph',               label:'pH',               unit:'',    displayMin:6.8, displayMax:8.0,  goodLow:7.2,  goodHigh:7.6,  warnLow:7.0,  warnHigh:7.8,  rangeLabel:'7.2 – 7.6',    hardWater:false },
                { key:'free_chlorine',    label:'Free Chlorine',    unit:'ppm', displayMin:0,   displayMax:5,    goodLow:1,    goodHigh:3,    warnLow:0.5,  warnHigh:5,    rangeLabel:'1 – 3 ppm',      hardWater:false },
                { key:'total_alkalinity', label:'Total Alkalinity', unit:'ppm', displayMin:40,  displayMax:160,  goodLow:80,   goodHigh:120,  warnLow:60,   warnHigh:140,  rangeLabel:'80 – 120 ppm',   hardWater:false },
                { key:'cya',              label:'Cyanuric Acid',    unit:'ppm', displayMin:10,  displayMax:70,   goodLow:30,   goodHigh:50,   warnLow:20,   warnHigh:80,   rangeLabel:'30 – 50 ppm',    hardWater:false },
                { key:'calcium_hardness', label:'Calcium Hardness', unit:'ppm', displayMin:0,   displayMax:600,  goodLow:200,  goodHigh:400,  warnLow:150,  warnHigh:600,  rangeLabel:'200 – 400 ppm',  hardWater:true  },
              ]
              const pct = (v: number, lo: number, hi: number) => Math.min(100, Math.max(0, (v - lo) / (hi - lo) * 100))
              type RStatus = 'good'|'monitor'|'action'|'unknown'
              const getStatus = (val: number|null, gLo: number, gHi: number, wLo: number, wHi: number): RStatus => {
                if (val === null) return 'unknown'
                if (val >= gLo && val <= gHi) return 'good'
                if (val >= wLo && val <= wHi) return 'monitor'
                return 'action'
              }
              const SM: Record<RStatus,{dot:string;badge:string;badgeBg:string}> = {
                good:    { dot:'#1DB869', badge:'✓ In Range',    badgeBg:'rgba(29,184,105,0.12)'  },
                monitor: { dot:'#F5A623', badge:'Monitor',       badgeBg:'rgba(245,166,35,0.12)'  },
                action:  { dot:'#E5304A', badge:'Needs Action',  badgeBg:'rgba(229,48,74,0.10)'   },
                unknown: { dot:'#8AAABB', badge:'Not Tested',    badgeBg:'rgba(138,170,187,0.12)' },
              }
              return (
                <div className="mb-5">
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                    <div style={{width:3,height:18,background:'#00CCA3',borderRadius:2,flexShrink:0}} />
                    <p style={{fontSize:13,fontWeight:700,letterSpacing:'0.04em',color:'#1A3A4A',flex:1,fontFamily:"'Space Grotesk',sans-serif"}}>Water Report</p>
                    <p style={{fontSize:12,fontWeight:600,color:'#2A5570'}}>{new Date(t.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</p>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                    <div style={{display:'flex',alignItems:'center',gap:4}}>
                      <div style={{width:18,height:6,borderRadius:3,background:'rgba(139,92,246,0.22)',flexShrink:0}} />
                      <span style={{fontSize:10,color:'#8AAABB'}}>ideal range</span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:4}}>
                      <div style={{width:8,height:8,borderRadius:'50%',background:'#1A3A4A',flexShrink:0}} />
                      <span style={{fontSize:10,color:'#8AAABB'}}>your reading</span>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{border:'1.5px solid #E0EBF3'}}>
                    {REPORT_PARAMS.map((p, i) => {
                      const raw = t[p.key as keyof TestResult] as number | null
                      const status = getStatus(raw, p.goodLow, p.goodHigh, p.warnLow, p.warnHigh)
                      const { dot, badge, badgeBg } = SM[status]
                      const goodLoPct  = pct(p.goodLow,  p.displayMin, p.displayMax)
                      const goodHiPct  = pct(p.goodHigh, p.displayMin, p.displayMax)
                      const valPct     = raw !== null ? pct(raw, p.displayMin, p.displayMax) : null
                      const showHWNote = p.hardWater && raw !== null && raw > p.goodHigh
                      return (
                        <div key={p.key} style={{borderTop: i > 0 ? '1px solid #F0F6FA' : 'none'}}>
                          <div className="px-4 pt-3.5 pb-2.5">
                            {/* Name row */}
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{background:dot}} />
                              <p className="text-xs font-bold flex-1" style={{color:'#1A2E3B'}}>{p.label}</p>
                              {raw !== null ? (
                                <p className="text-sm font-bold mr-2" style={{color:dot, fontFamily:"'DM Mono',monospace"}}>
                                  {raw % 1 === 0 ? raw : raw.toFixed(1)}{p.unit ? ` ${p.unit}` : ''}
                                </p>
                              ) : null}
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{background:badgeBg, color:dot}}>
                                {badge}
                              </span>
                            </div>
                            {/* Range bar */}
                            {raw !== null ? (
                              <>
                                <div className="relative mb-1.5" style={{height:8, borderRadius:4, background:'#E8F0F6'}}>
                                  {/* Ideal zone */}
                                  <div style={{position:'absolute',top:0,bottom:0,left:`${goodLoPct}%`,width:`${goodHiPct-goodLoPct}%`,background:'rgba(139,92,246,0.22)',borderRadius:4}} />
                                  {/* Value marker */}
                                  {valPct !== null && (
                                    <div style={{position:'absolute',top:'50%',left:`${valPct}%`,transform:'translate(-50%,-50%)',width:14,height:14,borderRadius:'50%',background:dot,border:'2.5px solid white',boxShadow:`0 1px 5px ${dot}70`,zIndex:2}} />
                                  )}
                                </div>
                                <p className="text-[10px]" style={{color:'#8AAABB'}}>Ideal: {p.rangeLabel}</p>
                              </>
                            ) : (
                              <p className="text-[10px] italic" style={{color:'#8AAABB'}}>Test this parameter for a more complete score</p>
                            )}
                          </div>
                          {/* Hard water note */}
                          {showHWNote && (
                            <div className="mx-3 mb-3 px-3 py-2 rounded-xl flex items-start gap-2" style={{background:'rgba(0,120,184,0.05)',border:'1px solid rgba(0,120,184,0.14)'}}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4A7A9A" strokeWidth="2.2" strokeLinecap="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                              <p className="text-[11px] leading-snug" style={{color:'#4A7A9A'}}>
                                In hard water regions like Arizona, high calcium is chronic — tap water refills with similar hardness. A monthly sequestering agent (Jack&apos;s Magic, SeaKlear) keeps calcium in solution and prevents scale. Draining helps short-term but the hardness returns with the next refill.
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* ── THIS WEEK ───────────────────────────────────────────────── */}
            {(() => {
              const recs = liveRecs ?? lastTest.recommendations
              const hasActions = recs.action.length > 0
              const month = new Date().getMonth()
              const isPeakSeason = month >= 4 && month <= 8
              const quickDays = isPeakSeason ? '2–3' : '4–5'
              const fullDays  = isPeakSeason ? '7'   : '10–14'
              const v = (pool?.volume_gallons ?? 10000) / 10000
              const fc = lastTest.free_chlorine
              const ph = lastTest.ph
              const ta = lastTest.total_alkalinity
              const taAtHighEnd = ta !== null && ta >= 110  // at or near top of ideal 80–120
              function fmtLiq(floz: number): string {
                if (floz >= 128) return `${(floz / 128).toFixed(1)} gal`
                return `${Math.round(floz)} fl oz`
              }
              const fcDose = fmtLiq(Math.round(v * 13))
              const acidDose = fmtLiq(Math.round(v * 13))
              const hdr = (label: string) => (
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                  <div style={{width:3,height:16,background:'#00CCA3',borderRadius:2,flexShrink:0}} />
                  <p style={{fontSize:11,fontWeight:700,letterSpacing:'0.12em',color:'#2A5570',textTransform:'uppercase' as const,fontFamily:"'Space Grotesk',sans-serif"}}>{label}</p>
                </div>
              )
              if (hasActions) return (
                <div className="mb-5">
                  {hdr('After Your Treatment Plan')}
                  <div className="rounded-2xl px-4 py-3.5 shadow-sm" style={{background:'#F2F8FB',border:'1.5px solid #C8DDE8'}}>
                    <p className="text-sm font-bold mb-1" style={{color:'#1A3A4A'}}>Retest pH + chlorine in {quickDays} days</p>
                    <p className="text-xs leading-relaxed" style={{color:'#3D5566'}}>No need for a full strip — just confirm the treatment worked. Then a complete panel retest in {fullDays} days.</p>
                  </div>
                </div>
              )
              return (
                <div className="mb-5">
                  {hdr('Your Plan This Week')}
                  <div className="rounded-2xl overflow-hidden shadow-sm" style={{border:'1.5px solid #C8DDE8'}}>
                    <div className="px-4 py-4 border-b border-gray-100" style={{background:'#F2F8FB'}}>
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold text-white" style={{background:'#0078B8'}}>1</div>
                        <p className="text-sm font-bold" style={{color:'#1A3A4A'}}>Quick check in {quickDays} days</p>
                      </div>
                      <p className="text-xs leading-relaxed mb-2.5" style={{color:'#3D5566'}}>Test pH and free chlorine only — save your full strips for the 7-day retest.</p>
                      {fc !== null && (
                        <div className="flex items-start gap-2 mb-1">
                          <span className="text-xs font-bold shrink-0 mt-0.5" style={{color:'#0078B8'}}>→</span>
                          <p className="text-xs font-semibold" style={{color:'#1A3A4A'}}>FC drops below 1 ppm: add <span style={{color:'#0078B8'}}>{fcDose} liquid chlorine</span> (evening)</p>
                        </div>
                      )}
                      {ph !== null && (
                        <div className="flex items-start gap-2 mb-1">
                          <span className="text-xs font-bold shrink-0 mt-0.5" style={{color:'#0078B8'}}>→</span>
                          <p className="text-xs font-semibold" style={{color:'#1A3A4A'}}>pH above 7.6: add <span style={{color:'#0078B8'}}>{acidDose} muriatic acid</span>{taAtHighEnd ? ' — this will also nudge TA down' : ''}</p>
                        </div>
                      )}
                      {taAtHighEnd && (
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-bold shrink-0 mt-0.5" style={{color:'#8B5CF6'}}>→</span>
                          <p className="text-xs font-semibold" style={{color:'#1A3A4A'}}>TA is at the high end ({ta} ppm) — watch it alongside pH. One acid dose handles both.</p>
                        </div>
                      )}
                    </div>
                    <div className="px-4 py-4" style={{background:'#F8FBFD'}}>
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold text-white" style={{background:'#00967A'}}>2</div>
                        <p className="text-sm font-bold" style={{color:'#1A3A4A'}}>Full panel retest in {fullDays} days</p>
                      </div>
                      <p className="text-xs leading-relaxed" style={{color:'#3D5566'}}>Test all parameters and log results to keep your health score current. No need to test more often if chemistry is stable.</p>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Treatment plan — timeline grouped */}
            {((liveRecs ?? lastTest.recommendations).treatment_plan?.length ?? 0) > 0 ? (
              <>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                  <div style={{width:3,height:16,background:'#00CCA3',borderRadius:2,flexShrink:0}} />
                  <p style={{fontSize:11,fontWeight:700,letterSpacing:'0.12em',color:'#2A5570',textTransform:'uppercase',fontFamily:"'Space Grotesk',sans-serif"}}>Treatment Plan</p>
                  <span className="text-[10px] text-text-faint">exact doses, in order</span>
                </div>
                {(() => {
                  const steps = ((liveRecs ?? lastTest.recommendations).treatment_plan ?? []).filter((s: TreatmentStep) => s.param !== 'calcium')
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
                          <div className="pl-5 border-l-2" style={{borderColor: group.meta.color + '30'}}>
                            {group.steps.map((step, si) => {
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
                                <React.Fragment key={step.step}>
                                <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden mb-3">
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

                                {/* Inter-step wait connector */}
                                {si < group.steps.length - 1 && step.waitAfter && (
                                  <div className="flex items-center gap-2.5 px-3 py-2.5 mb-3 rounded-xl" style={{background:'rgba(0,120,184,0.05)', border:'1px dashed rgba(0,120,184,0.18)'}}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                                    </svg>
                                    <p className="text-[11px] font-medium leading-snug" style={{color:'#3A6A8A'}}>
                                      {step.waitAfter}
                                    </p>
                                  </div>
                                )}
                                </React.Fragment>
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
            {((liveRecs ?? lastTest.recommendations).maintenance?.length ?? 0) > 0 && (
              <>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                  <div style={{width:3,height:16,background:'#00CCA3',borderRadius:2,flexShrink:0}} />
                  <p style={{fontSize:11,fontWeight:700,letterSpacing:'0.12em',color:'#2A5570',textTransform:'uppercase',fontFamily:"'Space Grotesk',sans-serif"}}>Your Pool — Ongoing Guide</p>
                </div>
                <div className="rounded-2xl overflow-hidden mb-6" style={{boxShadow:'0 2px 12px rgba(0,45,68,0.10)', border:'1.5px solid #D0E2ED'}}>
                  {((liveRecs ?? lastTest.recommendations).maintenance ?? []).map((tip, i) => {
                    const catStyles: Record<string, { bg: string; color: string; accent: string }> = {
                      testing:   { bg:'rgba(0,150,122,0.13)',  color:'#00967A', accent:'#00967A' },
                      chlorine:  { bg:'rgba(0,120,184,0.13)',  color:'#0078B8', accent:'#0078B8' },
                      shock:     { bg:'rgba(220,38,38,0.11)',  color:'#DC2626', accent:'#DC2626' },
                      brushing:  { bg:'rgba(29,184,105,0.13)', color:'#1DB869', accent:'#1DB869' },
                      seasonal:  { bg:'rgba(217,119,6,0.13)',  color:'#D97706', accent:'#D97706' },
                      filter:    { bg:'rgba(79,70,229,0.12)',  color:'#4F46E5', accent:'#4F46E5' },
                      skimmer:   { bg:'rgba(6,182,212,0.13)',  color:'#0891B2', accent:'#0891B2' },
                      cartridge: { bg:'rgba(139,92,246,0.12)', color:'#7C3AED', accent:'#7C3AED' },
                      enzyme:    { bg:'rgba(16,185,129,0.12)', color:'#059669', accent:'#059669' },
                    }
                    const cs = catStyles[tip.category as keyof typeof catStyles] ?? { bg:'rgba(0,120,184,0.12)', color:'#0078B8', accent:'#0078B8' }
                    const icons: Record<string, React.ReactElement> = {
                      testing:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cs.color} strokeWidth="2" strokeLinecap="round"><path d="M9 3v11l-3 3h12l-3-3V3"/><line x1="9" y1="3" x2="15" y2="3"/></svg>,
                      chlorine:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cs.color} strokeWidth="2" strokeLinecap="round"><path d="M12 2C6 9 4 13 4 16a8 8 0 0 0 16 0c0-3-2-7-8-14z"/></svg>,
                      shock:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cs.color} strokeWidth="2" strokeLinecap="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
                      brushing:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cs.color} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/></svg>,
                      seasonal:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cs.color} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
                      filter:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cs.color} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>,
                      skimmer:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cs.color} strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/><path d="M7 3v18M17 3v18"/></svg>,
                      cartridge: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cs.color} strokeWidth="2" strokeLinecap="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="16" y2="15"/></svg>,
                      enzyme:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cs.color} strokeWidth="2" strokeLinecap="round"><path d="M12 2a5 5 0 0 1 5 5c0 5-5 8-5 11"/><path d="M12 2a5 5 0 0 0-5 5c0 5 5 8 5 11"/><line x1="5" y1="22" x2="19" y2="22"/></svg>,
                    }
                    return (
                      <div key={i} className="flex items-stretch bg-white" style={{borderTop: i > 0 ? '1.5px solid #E8F0F6' : 'none'}}>
                        {/* Left accent strip */}
                        <div className="w-1 shrink-0" style={{background: cs.accent}} />
                        <div className="flex items-start gap-3 px-4 py-4 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{background: cs.bg}}>
                            {icons[tip.category as keyof typeof icons]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold mb-0.5" style={{color:'#1A3A4A'}}>{tip.title}</p>
                            <p className="text-xs text-text-muted leading-relaxed">{tip.body}</p>
                          </div>
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
              const goodItems = (liveRecs ?? lastTest.recommendations).good.filter(g =>
                !(g.param === 'ph' && phNeedsShockPrep) && g.param !== 'calcium'
              )
              return goodItems.length > 0 ? (
              <div className="mb-5">
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                  <div style={{width:3,height:16,background:'#00CCA3',borderRadius:2,flexShrink:0}} />
                  <p style={{fontSize:11,fontWeight:700,letterSpacing:'0.12em',color:'#2A5570',textTransform:'uppercase',fontFamily:"'Space Grotesk',sans-serif"}}>Looking Good</p>
                </div>
                <div className="space-y-2">
                  {goodItems.map((a, i) => (
                    <div key={i} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3" style={{boxShadow:'0 2px 8px rgba(0,45,68,0.08)', border:'1.5px solid #D0EDD8'}}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{background:'rgba(29,184,105,0.14)', border:'1px solid rgba(29,184,105,0.25)'}}>
                        <IconCheck size={17} style={{color:'#1DB869'}} />
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
            {(liveRecs ?? lastTest.recommendations).unknown && (liveRecs ?? lastTest.recommendations).unknown.length > 0 && (
              <>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                  <div style={{width:3,height:16,background:'#00CCA3',borderRadius:2,flexShrink:0}} />
                  <p style={{fontSize:11,fontWeight:700,letterSpacing:'0.12em',color:'#2A5570',textTransform:'uppercase',fontFamily:"'Space Grotesk',sans-serif"}}>Not Tested</p>
                </div>
                <div className="space-y-3">
                  {(liveRecs ?? lastTest.recommendations).unknown.map((a, i) => (
                    <div key={i} className="bg-white rounded-2xl p-4 shadow-md border border-gray-200 opacity-80">
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
        <div className="bg-white rounded-2xl px-4 py-4 shadow-md border border-gray-200 mt-4 mb-2">
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

      {/* Test logged toast */}
      {showToast && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 px-4 py-3 rounded-2xl shadow-lg flex items-center gap-2.5 text-sm font-semibold text-white transition-all"
          style={{background:'#1DB869', maxWidth: 320, width:'calc(100% - 32px)'}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Test logged — your score is updated
        </div>
      )}

      {/* Upgrade success toast */}
      {showUpgradeToast && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 px-5 py-4 rounded-2xl shadow-xl flex items-center gap-3 transition-all"
          style={{background:'linear-gradient(135deg,#002D44,#005A52)', border:'1px solid rgba(0,224,176,0.3)', maxWidth:340, width:'calc(100% - 32px)'}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(0,224,176,0.2)" stroke="#00E0B0" strokeWidth="1.6" strokeLinejoin="round" className="shrink-0">
            <path d="M2 9l10 13L22 9 16 3H8L2 9z"/>
            <path d="M2 9h20M8 3l4 6 4-6" strokeLinecap="round"/>
          </svg>
          <div>
            <p className="text-sm font-bold text-white leading-tight">Welcome to PoolKeep Pro!</p>
            <p className="text-xs mt-0.5" style={{color:'rgba(255,255,255,0.6)'}}>Your account has been upgraded.</p>
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2" style={{zIndex:50}}>
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

