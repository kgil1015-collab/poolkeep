'use client'

import React, { useEffect, useRef, useState } from 'react'
import WaveDivider from '@/app/components/WaveDivider'
import InstallBanner from '@/app/components/InstallBanner'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

import type { TreatmentStep, MaintenanceTip, TestInput } from '@/lib/recommendations'
import { calculateRecommendations } from '@/lib/recommendations'

type User = { email: string; user_metadata: { full_name?: string } }

// Mirrors EDIT_LIMIT / EDIT_WINDOW_MS in app/api/log/route.ts — kept in sync manually
const EDIT_LIMIT = 3
const EDIT_WINDOW_MS = 12 * 60 * 60 * 1000

type TestResult = {
  id: string
  edit_count: number
  health_score: number
  created_at: string
  logged_timezone: string | null
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

// timeZone pins the display to wherever the test was actually logged, so it
// never shifts later just because you're viewing it from somewhere else.
// Falls back to the device's current zone for older rows logged before this
// was captured.
function timeAgo(iso: string, timeZone?: string | null) {
  const d = new Date(iso)
  const now = new Date()
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000)
  const tzOpt = timeZone ? { timeZone } : undefined
  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', ...tzOpt })
  if (diffMin < 60) return `${diffMin}m ago`
  // Compare calendar dates in the logged timezone, not elapsed hours
  const dDayStr   = d.toLocaleDateString('en-CA', tzOpt)
  const nowDayStr = now.toLocaleDateString('en-CA', tzOpt)
  const calDiff = Math.round((Date.parse(nowDayStr) - Date.parse(dDayStr)) / 86400000)
  if (calDiff === 0) return `Today at ${timeStr}`
  if (calDiff === 1) return `Yesterday at ${timeStr}`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...tzOpt }) + ` at ${timeStr}`
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
  const actionCount  = recs.action.filter(r => r.param !== 'calcium').length
  const monitorCount = recs.monitor.filter(r => r.param !== 'calcium').length
  const unknownCount = recs.unknown.filter(u => u.param !== 'salt' && u.param !== 'calcium').length
  return Math.max(10, 100 - actionCount * 20 - monitorCount * 10 - unknownCount * 6)
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
  // Use calendar days in the timezone the test was actually logged in (not
  // elapsed hours, and not wherever the device viewing this happens to be
  // now), so a test at 11pm last night correctly shows as "yesterday" the
  // next morning regardless of travel in between.
  const tzOpt      = lastTest.logged_timezone ? { timeZone: lastTest.logged_timezone } : undefined
  const daysSince  = Math.round((Date.parse(new Date().toLocaleDateString('en-CA', tzOpt)) - Date.parse(testDate.toLocaleDateString('en-CA', tzOpt))) / 86400000)

  if (hoursSince < 6) {
    const hasActions   = lastTest.recommendations.action.filter(r => r.param !== 'calcium').length > 0
    const monitorCount = lastTest.recommendations.monitor.filter(r => r.param !== 'calcium').length
    if (hasActions) return {
      salutation: `${timeGreeting}, ${firstName}!`,
      headline: 'Test logged — action needed',
      subline: 'Check the treatment plan below and work through the steps.',
      urgency: 1,
    }
    if (monitorCount >= 2) return {
      salutation: `${timeGreeting}, ${firstName}!`,
      headline: 'Test logged — a few things to watch',
      subline: 'See the water report and weekly plan below.',
      urgency: 0,
    }
    if (monitorCount === 1) return {
      salutation: `${timeGreeting}, ${firstName}!`,
      headline: 'Fresh test logged ✓',
      subline: 'One parameter to keep an eye on — see the water report below.',
      urgency: 0,
    }
    return {
      salutation: `${timeGreeting}, ${firstName}!`,
      headline: 'Fresh test logged ✓',
      subline: 'Your pool is all set — check back in a day or two.',
      urgency: 0,
    }
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
    const hasActions   = lastTest.recommendations.action.filter(r => r.param !== 'calcium').length > 0
    const monitorCount = lastTest.recommendations.monitor.filter(r => r.param !== 'calcium').length
    if (hasActions) return {
      salutation: `${timeGreeting}, ${firstName}!`,
      headline: "Your pool still needs attention",
      subline: "Yesterday's test flagged some items — work through the treatment plan to get back on track.",
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
      headline: 'Pool is looking great',
      subline: 'All parameters in range — keep up the great work.',
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
  const pickerRef = useRef<HTMLDivElement>(null)
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
      const { data: tests } = await supabase.from('test_results').select('id,edit_count,health_score,recommendations,created_at,logged_timezone,ph,free_chlorine,total_alkalinity,cya,calcium_hardness,salt').eq('pool_id', active.id).order('created_at', { ascending: false }).limit(1)
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

  useEffect(() => {
    if (!showPicker) return
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [showPicker])

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
    if (p.id === pool?.id) { setShowPicker(false); return }
    setPool(p)
    setRemindDays(p.remind_after_days ?? null)
    setLastTest(null)
    setShowPicker(false)
    localStorage.setItem('poolkeep_active_pool', p.id)
    const supabase = createClient()
    const { data: tests } = await supabase
      .from('test_results')
      .select('id,edit_count,health_score,recommendations,created_at,logged_timezone,ph,free_chlorine,total_alkalinity,cya,calcium_hardness,salt')
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
      <div className="bg-pool-deep px-5 pt-5 pb-2 relative overflow-hidden">
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
        <div className="flex items-center justify-between mb-1">
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

        <div className="flex justify-end mb-4">
          <button onClick={() => router.push('/faq')} className="font-bold hover:opacity-80 transition-opacity" style={{fontSize:13, color:'#29B8E8'}}>
            Help &amp; FAQ
          </button>
        </div>

        <p className="text-white/70 mb-2" style={{fontSize:14}}>{welcome.salutation}</p>

        {/* Compact score row */}
        {(() => {
          const score = lastTest ? computeScore((liveRecs ?? lastTest.recommendations)) : null
          const unknownCount = lastTest
            ? (liveRecs ?? lastTest.recommendations).unknown.filter(u => u.param !== 'salt').length
            : 0
          const testedCount = 5 - unknownCount
          const { color } = statusAccent(score)

          const fillH = score !== null ? Math.round(68 * displayScore / 100) : 0
          const offsetY = 68 - fillH
          const excellent = score !== null && score >= 90
          const waterDeep = excellent ? 'rgba(0,90,160,0.55)' : 'rgba(0,80,150,0.50)'
          const waveFront = excellent ? 'rgba(0,190,255,0.75)' : 'rgba(0,168,240,0.72)'
          const waveBack  = excellent ? 'rgba(0,150,220,0.45)' : 'rgba(0,140,210,0.42)'

          return (
            <div className="flex items-center gap-3 pt-1 mb-3">
              {/* Water-fill score circle */}
              <div className="relative flex items-center justify-center shrink-0" style={{width:84,height:84}}>
                <svg width="84" height="84" viewBox="0 0 84 84" style={{position:'absolute',top:0,left:0}}>
                  <defs>
                    <clipPath id="smCircleClip"><circle cx="42" cy="42" r="34"/></clipPath>
                  </defs>
                  <circle cx="42" cy="42" r="39" fill="none" stroke="rgba(0,160,230,0.15)" strokeWidth="6"/>
                  <circle cx="42" cy="42" r="35" fill="rgba(0,20,45,0.9)" stroke="rgba(0,170,240,0.55)" strokeWidth="2.5"/>
                  {score !== null && (
                    <g clipPath="url(#smCircleClip)">
                      <rect x="8" y="8" width="68" height="68" fill={waterDeep}
                        style={{transform:`translateY(${offsetY}px)`,transition:'transform 1.5s cubic-bezier(0.4,0,0.2,1)'}}
                      />
                      <g style={{transform:`translateY(${offsetY}px)`,transition:'transform 1.5s cubic-bezier(0.4,0,0.2,1)'}}>
                        <path d="M-50,8 Q-35,3 -20,8 Q-5,13 10,8 Q25,3 40,8 Q55,13 70,8 Q85,3 100,8 Q115,13 130,8 L130,16 L-50,16 Z"
                          fill={waveFront} style={{animation:'waveSurface 3s linear infinite'}}/>
                      </g>
                      <g style={{transform:`translateY(${offsetY+3}px)`,transition:'transform 1.5s cubic-bezier(0.4,0,0.2,1)'}}>
                        <path d="M-50,8 Q-35,13 -20,8 Q-5,3 10,8 Q25,13 40,8 Q55,3 70,8 Q85,13 100,8 L100,16 L-50,16 Z"
                          fill={waveBack} style={{animation:'waveSurface 4.5s linear infinite reverse'}}/>
                      </g>
                    </g>
                  )}
                  <circle cx="42" cy="42" r="35" fill="none" stroke="rgba(0,170,240,0.55)" strokeWidth="2.5"/>
                </svg>
                <div className="relative z-10">
                  <span className="text-white font-bold leading-none"
                    style={{fontSize: score !== null ? 36 : 18, fontFamily:"'Oswald',sans-serif",
                      letterSpacing:'-1px', textShadow:'0 1px 8px rgba(0,0,0,0.6)'}}>
                    {score ?? '—'}
                  </span>
                </div>
              </div>

              {/* Status text */}
              <div className="flex-1 min-w-0">
                <p className="text-white/90 font-bold leading-tight" style={{fontSize:18}}>{welcome.headline}</p>
                <p className="text-white/55 leading-snug mt-1 line-clamp-2" style={{fontSize:13}}>{welcome.subline}</p>
                {unknownCount > 0 && score !== null && (() => {
                  if (!lastTest) return null
                  const td = new Date(lastTest.created_at)
                  const ds = Math.round((Date.now() - new Date(td.getFullYear(), td.getMonth(), td.getDate()).getTime()) / 86400000)
                  if (ds >= 2) return null
                  return (
                    <button onClick={() => router.push('/log')} className="mt-1">
                      <span style={{fontSize:11,color:'#00E0B0',textDecoration:'underline',textUnderlineOffset:2}}>
                        Based on {testedCount}/5 — log more →
                      </span>
                    </button>
                  )
                })()}
              </div>

            </div>
          )
        })()}

        {/* Pool switcher */}
        <div className="pb-3" ref={pickerRef}>
          <button
            onClick={() => setShowPicker(p => !p)}
            className="inline-flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-teal shrink-0" />
            <span className="text-white/80 text-xs font-medium">
              {pool?.name ?? 'My Pool'} · {lastTest ? `Last tested ${timeAgo(lastTest.created_at, lastTest.logged_timezone)}` : 'No tests yet'}
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

      </div>

      {/* Wave transition */}
      <WaveDivider />

      <InstallBanner />

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
            {/* ── WATER REPORT ────────────────────────────────────────────── */}
            {(() => {
              const t = lastTest
              const isEditable = t.edit_count < EDIT_LIMIT && (Date.now() - new Date(t.created_at).getTime()) < EDIT_WINDOW_MS
              // Display ranges zoomed so the ideal zone occupies the center third —
              // a reading at the high end of ideal appears right-of-center,
              // low end appears left-of-center, outside ideal is clearly past the zone.
              const REPORT_PARAMS = [
                { key:'ph',               label:'pH',               short:'pH',   unit:'',    displayMin:6.8, displayMax:8.2,  goodLow:7.2,  goodHigh:7.6,  warnLow:7.0,  warnHigh:7.6,  rangeLabel:'7.2 – 7.6',    hardWater:false },
                { key:'free_chlorine',    label:'Free Chlorine',    short:'FC',   unit:'ppm', displayMin:0,   displayMax:5,    goodLow:1,    goodHigh:3,    warnLow:0.5,  warnHigh:5,    rangeLabel:'1 – 3 ppm',      hardWater:false },
                { key:'total_alkalinity', label:'Total Alkalinity', short:'TA',   unit:'ppm', displayMin:40,  displayMax:160,  goodLow:80,   goodHigh:120,  warnLow:60,   warnHigh:140,  rangeLabel:'80 – 120 ppm',   hardWater:false },
                { key:'cya',              label:'Cyanuric Acid',    short:'CYA',  unit:'ppm', displayMin:0,   displayMax:150,  goodLow:30,   goodHigh:50,   warnLow:20,   warnHigh:100,  rangeLabel:'30 – 50 ppm',    hardWater:false,
                  scaleFn: (v: number) => v <= 50 ? v : v <= 90 ? 50 + (v - 50) / 40 * 25 : 75 + (v - 90) / 60 * 25 },
                { key:'calcium_hardness', label:'Water Hardness',   short:'WH',   unit:'ppm', displayMin:0,   displayMax:600,  goodLow:200,  goodHigh:400,  warnLow:150,  warnHigh:600,  rangeLabel:'200 – 400 ppm',  hardWater:true  },
              ]
              const pct = (v: number, lo: number, hi: number) => Math.min(100, Math.max(0, (v - lo) / (hi - lo) * 100))
              type RStatus = 'good'|'monitor'|'action'|'unknown'
              // Report cards must always agree with the status banner and treatment plan,
              // so pull status from the same recommendations engine instead of a second
              // set of thresholds — a numeric range here is only a fallback.
              const recs = liveRecs ?? lastTest.recommendations
              const PARAM_TO_REC: Record<string, string> = {
                ph: 'ph',
                free_chlorine: 'chlorine',
                total_alkalinity: 'alkalinity',
                cya: 'cya',
                calcium_hardness: 'calcium',
              }
              const recStatusFor = (recParam: string): RStatus | null => {
                if (recs.action.some(r => r.param === recParam)) return 'action'
                if (recs.monitor.some(r => r.param === recParam)) return 'monitor'
                if (recs.good.some(r => r.param === recParam)) return 'good'
                if (recs.unknown.some(r => r.param === recParam)) return 'unknown'
                return null
              }
              const getStatus = (val: number|null, gLo: number, gHi: number, wLo: number, wHi: number, key?: string): RStatus => {
                if (key) {
                  const hit = recStatusFor(PARAM_TO_REC[key])
                  if (hit) return hit
                }
                if (val === null) return 'unknown'
                if (val >= gLo && val <= gHi) return 'good'
                if (val >= wLo && val <= wHi) return 'monitor'
                return 'action'
              }
              // Blue reads as "good" for a pool app (clear water), so it's reserved for
              // in-range values. Monitor gets amber (the universal "keep an eye on it"
              // caution color) and out-of-range gets red — keeps all three visually
              // distinct instead of blue/teal competing for the same "fine" meaning.
              const SM: Record<RStatus,{dot:string;badge:string;badgeBg:string}> = {
                good:    { dot:'#00A8F0', badge:'In Range',    badgeBg:'rgba(0,168,240,0.18)'   },
                monitor: { dot:'#F5A623', badge:'Monitor',     badgeBg:'rgba(245,166,35,0.18)'  },
                action:  { dot:'#E5304A', badge:'Out of Range',badgeBg:'rgba(229,48,74,0.18)'   },
                unknown: { dot:'#8AAABB', badge:'Not Tested',  badgeBg:'rgba(138,170,187,0.12)' },
              }
              return (
                <div className="mb-5">
                  {/* Section title */}
                  <div style={{display:'flex',alignItems:'center',marginBottom:10}}>
                    <p style={{fontSize:18,fontWeight:800,color:'#0B1E35',letterSpacing:'-.02em',fontFamily:"'Oswald',sans-serif",textTransform:'uppercase'}}>Water Report</p>
                    <div style={{flex:1}} />
                    <p style={{fontSize:11,fontWeight:600,color:'#5A7A8A'}}>{new Date(t.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric', ...(t.logged_timezone ? {timeZone:t.logged_timezone} : {})})}</p>
                  </div>

                  {/* Dark navy panel */}
                  <div style={{background:'#0B1E35',borderRadius:16,overflow:'hidden'}}>
                    {/* Compact stat tiles — all params at a glance */}
                    <div style={{display:'flex',gap:6,padding:'12px 12px 6px'}}>
                      {REPORT_PARAMS.map(p => {
                        const raw = t[p.key as keyof TestResult] as number | null
                        const status = getStatus(raw, p.goodLow, p.goodHigh, p.warnLow, p.warnHigh, p.key)
                        const { dot } = SM[status]
                        return (
                          <div
                            key={p.key}
                            onClick={isEditable ? () => router.push(`/log?edit=${t.id}`) : undefined}
                            style={{flex:1,background:'rgba(255,255,255,0.06)',borderRadius:8,padding:'7px 6px',border:`1.5px solid ${dot}`,overflow:'hidden',position:'relative',cursor: isEditable ? 'pointer' : 'default'}}
                          >
                            {/* colored top bar */}
                            <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:dot,opacity:0.7}} />
                            <div style={{fontSize:10,color:'#ffffff',fontWeight:800,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:3,marginTop:4}}>{p.short}</div>
                            <div style={{fontSize:16,fontWeight:700,color: raw !== null ? dot : 'rgba(255,255,255,0.2)',lineHeight:1,fontFamily:"'DM Mono',monospace"}}>
                              {raw !== null ? (raw % 1 === 0 ? String(raw) : raw.toFixed(1)) : '—'}
                            </div>
                            <div style={{fontSize:9,fontWeight:700,marginTop:4,color: raw !== null ? dot : 'rgba(255,255,255,0.25)',lineHeight:1.2}}>{raw !== null ? SM[status].badge : '—'}</div>
                          </div>
                        )
                      })}
                    </div>
                    {isEditable && (
                      <p style={{fontSize:9,fontStyle:'italic',color:'rgba(255,255,255,0.35)',padding:'0 12px 8px'}}>Tap a value above to fix a misread</p>
                    )}

                    {/* Legend */}
                    <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:'6px 12px',padding:'4px 12px 8px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:4}}>
                        <div style={{width:16,height:6,borderRadius:3,background:'rgba(0,170,240,0.55)'}} />
                        <span style={{fontSize:9,color:'rgba(255,255,255,0.45)',fontWeight:600}}>ideal</span>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:4}}>
                        <div style={{width:12,height:12,borderRadius:'50%',background:'#fff',border:'2.5px solid #00A8F0'}} />
                        <span style={{fontSize:9,color:'rgba(255,255,255,0.45)',fontWeight:600}}>in range</span>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:4}}>
                        <div style={{width:12,height:12,borderRadius:'50%',background:'#fff',border:'2.5px solid #F5A623'}} />
                        <span style={{fontSize:9,color:'rgba(255,255,255,0.45)',fontWeight:600}}>monitor</span>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:4}}>
                        <div style={{width:12,height:12,borderRadius:'50%',background:'#fff',border:'2.5px solid #E5304A'}} />
                        <span style={{fontSize:9,color:'rgba(255,255,255,0.45)',fontWeight:600}}>out of range</span>
                      </div>
                    </div>

                    {/* Detailed rows */}
                    {REPORT_PARAMS.map((p, i) => {
                      const raw = t[p.key as keyof TestResult] as number | null
                      const status = getStatus(raw, p.goodLow, p.goodHigh, p.warnLow, p.warnHigh, p.key)
                      const { dot, badge, badgeBg } = SM[status]
                      const scalePct   = (v: number) => p.scaleFn ? p.scaleFn(v) : pct(v, p.displayMin, p.displayMax)
                      const goodLoPct  = scalePct(p.goodLow)
                      const goodHiPct  = scalePct(p.goodHigh)
                      const valPct     = raw !== null ? scalePct(raw) : null
                      const showHWNote = p.hardWater && raw !== null && raw > p.goodHigh
                      return (
                        <div key={p.key} style={{borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none', padding:'9px 12px'}}>
                          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom: raw !== null ? 7 : 0}}>
                            <span style={{fontSize:12,fontWeight:700,color:'rgba(255,255,255,0.85)',flex:1,fontVariant:'small-caps',letterSpacing:'0.04em'}}>{p.label}</span>
                            {raw !== null && (
                              <span style={{fontSize:13,fontWeight:700,color:dot,fontFamily:"'DM Mono',monospace"}}>
                                {raw % 1 === 0 ? raw : raw.toFixed(1)}{p.unit ? ` ${p.unit}` : ''}
                              </span>
                            )}
                            <span style={{fontSize:8,fontWeight:700,padding:'2px 7px',borderRadius:20,background:badgeBg,color:dot,flexShrink:0}}>{badge}</span>
                          </div>
                          {raw !== null ? (
                            <>
                              <div style={{height:7,borderRadius:3.5,position:'relative',marginLeft:16,background:'rgba(0,120,184,0.2)',overflow:'visible'}}>
                                <div style={{position:'absolute',top:0,bottom:0,left:`${goodLoPct}%`,width:`${goodHiPct-goodLoPct}%`,background:'rgba(0,170,240,0.55)',borderRadius:3.5}} />
                                {valPct !== null && (
                                  <div style={{position:'absolute',top:'50%',left:`${valPct}%`,transform:'translate(-50%,-50%)',width:17,height:17,borderRadius:'50%',background:'#fff',border:`3px solid ${dot}`,boxShadow:'0 2px 6px rgba(0,0,0,0.5)',zIndex:2}} />
                                )}
                              </div>
                              <p style={{fontSize:10,fontWeight:500,color:'rgba(255,255,255,0.50)',marginTop:4,marginLeft:16}}>Ideal: {p.rangeLabel}</p>
                            </>
                          ) : (
                            <p style={{fontSize:10,color:'rgba(255,255,255,0.50)',marginLeft:16,fontStyle:'italic'}}>Log this to improve score accuracy</p>
                          )}
                          {showHWNote && (
                            <div style={{marginTop:8,marginLeft:16,padding:'8px 10px',borderRadius:8,background:'rgba(91,200,245,0.1)',border:'0.5px solid rgba(91,200,245,0.25)',display:'flex',gap:6,alignItems:'flex-start'}}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#5BC8F5" strokeWidth="2.2" strokeLinecap="round" style={{flexShrink:0,marginTop:1}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                              <p style={{fontSize:10,lineHeight:1.5,color:'rgba(255,255,255,0.45)'}}>
                                In hard water regions like Arizona, high calcium is chronic. A monthly sequestering agent (Jack&apos;s Magic, SeaKlear) keeps calcium in solution and prevents scale.
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

            {/* ── ALL GOOD card — only when nothing needs action ──────────── */}
            {(() => {
              const recs = liveRecs ?? lastTest.recommendations
              if (recs.action.length > 0 || recs.monitor.length > 0) return null
              const unknownNonSalt = recs.unknown.filter(u => u.param !== 'salt').length
              const hasUnknowns = unknownNonSalt > 0
              const testedBars = 5 - unknownNonSalt
              return (
                <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-200 flex items-start gap-3 mb-5">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{background: hasUnknowns ? 'rgba(0,150,122,0.10)' : 'rgba(29,184,105,0.12)'}}>
                    {hasUnknowns ? (
                      <svg width="20" height="18" viewBox="0 0 20 18" fill="none">
                        {[0,1,2,3,4].map(i => (
                          <rect key={i} x={i * 4.2} y={i < testedBars ? 18 - (6 + i * 2.5) : 13} width="3" height={i < testedBars ? 6 + i * 2.5 : 5} rx="1"
                            fill={i < testedBars ? '#00967A' : '#D1E8E2'} />
                        ))}
                      </svg>
                    ) : <IconCheck size={20} style={{color:'#1DB869'}} />}
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
            })()}

            {/* Treatment plan — timeline grouped */}
            {((liveRecs ?? lastTest.recommendations).treatment_plan?.length ?? 0) > 0 ? (
              <>
                <div style={{display:'flex',alignItems:'center',marginBottom:12}}>
                  <p style={{fontSize:18,fontWeight:800,color:'#0B1E35',letterSpacing:'-.02em',fontFamily:"'Oswald',sans-serif",textTransform:'uppercase' as const}}>Treatment Plan</p>
                  <div style={{flex:1}} />
                  <span style={{fontSize:11,fontWeight:600,color:'#5A7A8A'}}>exact doses · in order</span>
                </div>
                {(() => {
                  const steps = ((liveRecs ?? lastTest.recommendations).treatment_plan ?? []).filter((s: TreatmentStep) => s.param !== 'calcium')
                  const WHEN_ORDER = ['today', 'in-1-2-days', 'this-week', 'plan-ahead'] as const
                  const WHEN_LABELS: Record<string, { label: string; sublabel: string; color: string; bg: string }> = {
                    'today':       { label: 'Do Today',     sublabel: 'Start here',              color: '#DC2626', bg: 'rgba(220,38,38,0.07)' },
                    'in-1-2-days': { label: 'In 1–2 Days',  sublabel: 'After first steps settle', color: '#D97706', bg: 'rgba(217,119,6,0.07)'  },
                    'this-week':   { label: 'This Week',    sublabel: 'In 3–7 days',              color: '#0078B8', bg: 'rgba(0,120,184,0.06)'  },
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
                              {group.when === 'today'
                                ? <span className="text-[11px] font-bold ml-2" style={{color: group.meta.color}}>↓ Start here</span>
                                : <span className="text-[11px] font-semibold ml-2" style={{color:'#5A7A8A'}}>{group.meta.sublabel}</span>
                              }
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
                                <div className="overflow-hidden mb-3" style={{background:'#fff',borderRadius:14,border:'0.5px solid #E0EBF3'}}>
                                  {/* Option C: blue left-bar step number */}
                                  <div className="flex items-stretch">
                                    <div style={{width:44,background:'#0B1E35',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,padding:'14px 0'}}>
                                      <span style={{color:'#5BC8F5',fontSize:17,fontWeight:700,fontFamily:"'Oswald',sans-serif"}}>{step.step}</span>
                                    </div>
                                    <div className="flex-1 min-w-0 px-3 pt-3 pb-3">
                                      <p className="font-bold text-sm leading-snug mb-1.5" style={{color:'#0B1E35'}}>{step.title}</p>
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
                                          // Multi-chemical step — numbered sub-steps, with OR divider for chlorine options
                                          <div className="bg-surface rounded-lg px-2.5 py-2 mb-2 space-y-2.5">
                                            {(() => {
                                              // Count how many sequential "do ALL" steps come before the chlorine OR-pair
                                              let numberedCount = 0
                                              const elements: React.ReactNode[] = []
                                              let i = 0
                                              while (i < chemLines.length) {
                                                const chem = chemLines[i]
                                                const lineAmount = amountLines[i] ?? ''
                                                const isLiquidChlor = chem.toLowerCase().includes('liquid chlorine')
                                                const isGranularShock = chem.toLowerCase().includes('granular') || (chem.toLowerCase().includes('shock') && !chem.toLowerCase().includes('liquid'))
                                                const isAcid = chem.toLowerCase().includes('acid') || chem.toLowerCase().includes('reducer') || chem.toLowerCase().includes('ph down')
                                                const isAerate = chem.toLowerCase().includes('jet') || chem.toLowerCase().includes('aerate')

                                                // Check if this AND the next line form a liquid/granular OR-pair
                                                const nextChem = chemLines[i + 1] ?? ''
                                                const nextIsGranular = nextChem.toLowerCase().includes('granular') || (nextChem.toLowerCase().includes('shock') && !nextChem.toLowerCase().includes('liquid'))
                                                if (isLiquidChlor && nextIsGranular) {
                                                  // Render as step N with A/B OR-pair inside
                                                  const nextAmount = amountLines[i + 1] ?? ''
                                                  numberedCount++
                                                  elements.push(
                                                    <div key={`or-pair-${i}`}>
                                                      <div className="flex items-center gap-2 mb-1.5">
                                                        <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold text-white" style={{background:'#00967A',minWidth:16}}>{numberedCount}</span>
                                                        <p className="text-xs font-bold" style={{color:'#00967A'}}>Add chlorine — choose one:</p>
                                                      </div>
                                                      {/* Option A — Liquid */}
                                                      <div className="rounded-lg px-2.5 py-2 mb-1.5" style={{background:'rgba(0,150,122,0.07)',border:'1px solid rgba(0,150,122,0.18)'}}>
                                                        <div className="flex items-center gap-1.5 mb-0.5">
                                                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{background:'#5A7A8A',color:'#fff'}}>A</span>
                                                          <p className="text-xs font-bold" style={{color:'#3A6080'}}>Liquid Chlorine</p>
                                                          <p className="text-xs font-semibold text-text-muted">{lineAmount}</p>
                                                        </div>
                                                        <p className="text-[10px] italic" style={{color:'#3A6080'}}>Retest in 1–4 hrs — swim when FC &lt; 5 ppm.</p>
                                                      </div>
                                                      {/* OR divider */}
                                                      <div className="flex items-center gap-2 my-1">
                                                        <div className="flex-1 h-px" style={{background:'rgba(0,0,0,0.08)'}} />
                                                        <span className="text-[10px] font-bold" style={{color:'#8AAABB'}}>OR</span>
                                                        <div className="flex-1 h-px" style={{background:'rgba(0,0,0,0.08)'}} />
                                                      </div>
                                                      {/* Option B — Granular */}
                                                      <div className="rounded-lg px-2.5 py-2" style={{background:'rgba(0,150,122,0.07)',border:'1px solid rgba(0,150,122,0.18)'}}>
                                                        <div className="flex items-center gap-1.5 mb-0.5">
                                                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{background:'#5A7A8A',color:'#fff'}}>B</span>
                                                          <div>
                                                            <p className="text-xs font-bold" style={{color:'#3A6080'}}>Granular Shock (cal-hypo)</p>
                                                            <p className="text-xs font-semibold text-text-muted">{nextAmount}</p>
                                                          </div>
                                                        </div>
                                                        <p className="text-[10px] italic" style={{color:'#3A6080'}}>Add in the evening. Pre-dissolve in a bucket first. Retest the next morning.</p>
                                                      </div>
                                                    </div>
                                                  )
                                                  i += 2
                                                  continue
                                                }

                                                // Regular numbered step
                                                numberedCount++
                                                const stepColor = isAcid ? '#0078B8' : isAerate ? '#00967A' : '#00967A'
                                                elements.push(
                                                  <div key={i} className="flex items-start gap-2">
                                                    <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold text-white mt-0.5" style={{background: stepColor, minWidth:16}}>{numberedCount}</span>
                                                    <div>
                                                      <p className="text-xs font-bold" style={{color: stepColor}}>{chem}</p>
                                                      {lineAmount && <p className="text-xs font-semibold text-text-muted mt-0.5">{lineAmount}</p>}
                                                      {isAcid && (
                                                        <div className="flex items-center gap-1 mt-1">
                                                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                                          <p className="text-[10px] italic" style={{color:'#0078B8'}}>Wait 30–60 min before adding chlorine</p>
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                )
                                                i++
                                              }
                                              return elements
                                            })()}
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
                                      {!(step.chemical?.toLowerCase().includes('liquid chlorine') && step.chemical?.toLowerCase().includes('granular')) && (
                                        <p className="text-xs text-text-muted leading-relaxed">{actionLine}</p>
                                      )}
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
                                  <div className="flex items-center gap-2.5 px-3 py-2.5 mb-3 rounded-xl" style={{background:'linear-gradient(160deg,#EAF5FF 0%,#F4FAFF 100%)', border:'1.5px solid #0078B8', boxShadow:'0 2px 8px rgba(0,120,184,0.18)'}}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                                    </svg>
                                    <p className="text-[11px] font-bold leading-snug" style={{color:'#0B4A70'}}>
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
              const taAtHighEnd = ta !== null && ta >= 110
              function fmtLiq(floz: number): string {
                if (floz >= 128) return `${(floz / 128).toFixed(1)} gal`
                return `${Math.round(floz)} fl oz`
              }
              const fcDose = fmtLiq(Math.round(v * 13))
              const acidDose = fmtLiq(Math.round(v * 13))
              const hdr = (label: string) => (
                <p style={{fontSize:18,fontWeight:800,color:'#0B1E35',letterSpacing:'-.02em',fontFamily:"'Oswald',sans-serif",textTransform:'uppercase' as const,marginBottom:10}}>{label}</p>
              )
              if (hasActions) return (
                <div className="mb-5">
                  {hdr('After Your Treatment Plan')}
                  <div className="rounded-2xl overflow-hidden" style={{border:'0.5px solid #B0D8F0',boxShadow:'0 2px 10px rgba(0,100,160,0.08)'}}>
                    <div style={{height:5,background:'linear-gradient(90deg,#0078B8 0%,#5BC8F5 100%)'}} />
                    <div style={{background:'linear-gradient(160deg,#EAF5FF 0%,#F4FAFF 100%)'}}>
                      <div className="px-5 py-5">
                        <p style={{fontSize:14,fontWeight:700,color:'#0B1E35',marginBottom:4,letterSpacing:'-.01em'}}>Retest pH + chlorine in {quickDays} days</p>
                        <p style={{fontSize:12,lineHeight:1.5,color:'#3A6080'}}>Check pH and free chlorine to confirm the treatment worked. Then a complete panel retest in {fullDays} days.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
              return (
                <div className="mb-5">
                  {hdr('Your Plan This Week')}
                  <div className="rounded-2xl overflow-hidden" style={{border:'0.5px solid #B0D8F0',boxShadow:'0 2px 10px rgba(0,100,160,0.08)'}}>
                    <div style={{height:4,background:'linear-gradient(90deg,#0078B8 0%,#5BC8F5 100%)'}} />
                    <div className="px-5 py-5" style={{background:'linear-gradient(160deg,#EAF5FF 0%,#F4FAFF 100%)'}}>
                      <div className="flex items-center gap-3 mb-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white" style={{background:'#0078B8'}}>1</div>
                        <p style={{fontSize:16,fontWeight:800,color:'#0B1E35',letterSpacing:'-.01em'}}>Quick check in {quickDays} days</p>
                      </div>
                      <p style={{fontSize:13,lineHeight:1.6,color:'#3A6080',marginBottom:12}}>Test pH and free chlorine only — save your full strips for the 7-day retest.</p>
                      {fc !== null && (
                        <div className="flex items-start gap-2 mb-1.5">
                          <span className="font-bold shrink-0 mt-0.5" style={{color:'#0078B8',fontSize:13}}>→</span>
                          <p style={{fontSize:13,fontWeight:600,color:'#0B1E35'}}>FC drops below 1 ppm: add <span style={{color:'#0078B8'}}>{fcDose} liquid chlorine</span> (evening)</p>
                        </div>
                      )}
                      {ph !== null && (
                        <div className="flex items-start gap-2 mb-1.5">
                          <span className="font-bold shrink-0 mt-0.5" style={{color:'#0078B8',fontSize:13}}>→</span>
                          <p style={{fontSize:13,fontWeight:600,color:'#0B1E35'}}>pH above 7.6: add <span style={{color:'#0078B8'}}>{acidDose} muriatic acid</span>{taAtHighEnd ? ' — also nudges TA down' : ''}</p>
                        </div>
                      )}
                      {taAtHighEnd && (
                        <div className="flex items-start gap-2">
                          <span className="font-bold shrink-0 mt-0.5" style={{color:'#5BC8F5',fontSize:13}}>→</span>
                          <p style={{fontSize:13,fontWeight:600,color:'#0B1E35'}}>TA is at the high end ({ta} ppm) — one acid dose handles both.</p>
                        </div>
                      )}
                    </div>
                    <div className="px-5 py-5" style={{background:'linear-gradient(160deg,#F0F8FF 0%,#F8FCFF 100%)',borderTop:'1px solid rgba(0,120,184,0.10)'}}>
                      <div className="flex items-center gap-3 mb-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white" style={{background:'#00967A'}}>2</div>
                        <p style={{fontSize:16,fontWeight:800,color:'#0B1E35',letterSpacing:'-.01em'}}>Full panel retest in {fullDays} days</p>
                      </div>
                      <p style={{fontSize:13,lineHeight:1.6,color:'#3A6080'}}>Test all parameters and log results to keep your health score current. No need to test more often if chemistry is stable.</p>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Ongoing maintenance guide */}
            {((liveRecs ?? lastTest.recommendations).maintenance?.length ?? 0) > 0 && (
              <>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                  <div style={{width:3,height:16,background:'#5BC8F5',borderRadius:2,flexShrink:0}} />
                  <p style={{fontSize:18,fontWeight:800,color:'#0B1E35',letterSpacing:'-.02em',fontFamily:"'Oswald',sans-serif",textTransform:'uppercase'}}>Your Pool — Ongoing Guide</p>
                </div>
                <div className="mb-6" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {((liveRecs ?? lastTest.recommendations).maintenance ?? []).map((tip, i) => {
                    const catStyles: Record<string, { dot: string; iconStroke: string; iconBg: string }> = {
                      testing:   { dot:'#00CCA3', iconStroke:'#00CCA3', iconBg:'rgba(0,204,163,0.12)' },
                      chlorine:  { dot:'#5BC8F5', iconStroke:'#5BC8F5', iconBg:'rgba(91,200,245,0.12)' },
                      shock:     { dot:'#F0A500', iconStroke:'#F0A500', iconBg:'rgba(240,165,0,0.12)'  },
                      brushing:  { dot:'#00CCA3', iconStroke:'#00CCA3', iconBg:'rgba(0,204,163,0.12)' },
                      seasonal:  { dot:'#F0A500', iconStroke:'#F0A500', iconBg:'rgba(240,165,0,0.12)'  },
                      filter:    { dot:'#5BC8F5', iconStroke:'#5BC8F5', iconBg:'rgba(91,200,245,0.12)' },
                      skimmer:   { dot:'#5BC8F5', iconStroke:'#5BC8F5', iconBg:'rgba(91,200,245,0.12)' },
                      cartridge: { dot:'#00CCA3', iconStroke:'#00CCA3', iconBg:'rgba(0,204,163,0.12)' },
                      enzyme:    { dot:'#00CCA3', iconStroke:'#00CCA3', iconBg:'rgba(0,204,163,0.12)' },
                    }
                    const cs = catStyles[tip.category as keyof typeof catStyles] ?? { dot:'#5BC8F5', iconStroke:'#5BC8F5', iconBg:'rgba(91,200,245,0.12)' }
                    const icons: Record<string, React.ReactElement> = {
                      testing:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cs.iconStroke} strokeWidth="2" strokeLinecap="round"><path d="M9 3v11l-3 3h12l-3-3V3"/><line x1="9" y1="3" x2="15" y2="3"/></svg>,
                      chlorine:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cs.iconStroke} strokeWidth="2" strokeLinecap="round"><path d="M12 2C6 9 4 13 4 16a8 8 0 0 0 16 0c0-3-2-7-8-14z"/></svg>,
                      shock:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cs.iconStroke} strokeWidth="2" strokeLinecap="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
                      brushing:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cs.iconStroke} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/></svg>,
                      seasonal:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cs.iconStroke} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
                      filter:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cs.iconStroke} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>,
                      skimmer:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cs.iconStroke} strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/><path d="M7 3v18M17 3v18"/></svg>,
                      cartridge: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cs.iconStroke} strokeWidth="2" strokeLinecap="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="16" y2="15"/></svg>,
                      enzyme:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cs.iconStroke} strokeWidth="2" strokeLinecap="round"><path d="M12 2a5 5 0 0 1 5 5c0 5-5 8-5 11"/><path d="M12 2a5 5 0 0 0-5 5c0 5 5 8 5 11"/><line x1="5" y1="22" x2="19" y2="22"/></svg>,
                    }
                    return (
                      <div key={i} style={{background:'#003D5C',borderRadius:14,padding:'14px 12px'}}>
                        <div className="flex items-center gap-2 mb-2">
                          <div style={{width:34,height:34,borderRadius:9,background:cs.iconBg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            {icons[tip.category as keyof typeof icons]}
                          </div>
                          <div style={{width:6,height:6,borderRadius:'50%',background:cs.dot,flexShrink:0}} />
                        </div>
                        <p style={{fontSize:12,fontWeight:700,color:'rgba(255,255,255,0.92)',lineHeight:1.35,marginBottom:5}}>{tip.title}</p>
                        <p style={{fontSize:11,color:'rgba(255,255,255,0.50)',lineHeight:1.5}}>{tip.body}</p>
                      </div>
                    )
                  })}
                </div>
              </>
            )}


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

