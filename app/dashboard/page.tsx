'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { TreatmentStep, TestInput } from '@/lib/recommendations'
import { calculateRecommendations } from '@/lib/recommendations'

// ─── Types ───────────────────────────────────────────────────────────────────

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
    maintenance?: { title: string; body: string; category: string }[]
    unknown: { param: string; title: string; desc: string; tags: string[] }[]
    action:  { param: string; title: string; desc: string; tags: string[] }[]
    monitor: { param: string; title: string; desc: string; tags: string[] }[]
    good:    { param: string; title: string; desc: string; tags: string[] }[]
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000)
  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (diffMin < 60) return `${diffMin}m ago`
  const dDay   = new Date(d.getFullYear(),   d.getMonth(),   d.getDate())
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const calDiff = Math.round((nowDay.getTime() - dDay.getTime()) / 86400000)
  if (calDiff === 0) return `Today at ${timeStr}`
  if (calDiff === 1) return `Yesterday at ${timeStr}`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` at ${timeStr}`
}

function computeScore(recs: TestResult['recommendations']): number {
  const actionCount  = recs.action.filter(r => r.param !== 'calcium').length
  const monitorCount = recs.monitor.filter(r => r.param !== 'calcium').length
  const unknownCount = recs.unknown.filter(u => u.param !== 'salt' && u.param !== 'calcium').length
  return Math.max(10, 100 - actionCount * 20 - monitorCount * 10 - unknownCount * 6)
}

function scoreLabel(score: number) {
  if (score >= 90) return 'Excellent condition'
  if (score >= 82) return 'Good condition'
  if (score >= 68) return 'A few things to watch'
  if (score >= 50) return 'Needs attention'
  return 'Action required'
}

// ─── Theme ───────────────────────────────────────────────────────────────────

const th = {
  bg:            '#F0F4F8',
  card:          '#FFFFFF',
  navy:          '#0D2B45',
  teal:          '#1A8C7E',
  tealLight:     '#E6F4F2',
  red:           '#D64045',
  redLight:      '#FDECEA',
  amber:         '#E07B39',
  amberLight:    '#FEF3EC',
  blue:          '#2E6DB4',
  blueLight:     '#EBF2FB',
  textPrimary:   '#1A1F2E',
  textSecondary: '#5A6478',
  border:        '#E2E8F0',
}

// ─── Design Primitives ────────────────────────────────────────────────────────

const StatusBadge = ({ label, color }: { label: string; color: 'critical' | 'warning' | 'ok' }) => {
  const colors = {
    critical: { bg: th.redLight,   text: th.red,   dot: th.red   },
    warning:  { bg: th.amberLight, text: th.amber, dot: th.amber },
    ok:       { bg: th.tealLight,  text: th.teal,  dot: th.teal  },
  }
  const c = colors[color]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: c.bg, color: c.text, borderRadius: 20,
      padding: '3px 10px', fontSize: 11, fontWeight: 700,
      letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, display: 'inline-block' }} />
      {label}
    </span>
  )
}

const StepBadge = ({ n, color }: { n: number; color: string }) => (
  <span style={{
    width: 26, height: 26, borderRadius: '50%',
    background: color, color: '#fff',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 800, flexShrink: 0,
  }}>{n}</span>
)

const Divider = () => (
  <div style={{ height: 1, background: th.border, margin: '4px 0' }} />
)

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    fontSize: 15, fontWeight: 800, letterSpacing: '0.06em',
    color: th.textPrimary, textTransform: 'uppercase',
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
  }}>
    <span style={{ width: 3, height: 16, background: th.teal, borderRadius: 2, display: 'inline-block' }} />
    {children}
  </div>
)

const Card = ({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{
    background: th.card, borderRadius: 16,
    padding: '16px 18px', marginBottom: 10,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    border: `1px solid ${th.border}`,
    ...style,
  }}>
    {children}
  </div>
)

const WaterParam = ({
  label, value, unit, status, ideal, pct,
}: {
  label: string; value: number | null; unit: string
  status: 'ok' | 'warning' | 'critical' | 'unknown'
  ideal: string; pct: number
}) => {
  const barColor = status === 'ok' ? th.teal : status === 'warning' ? th.amber : status === 'critical' ? th.red : th.textSecondary
  const statusLabel = status === 'ok' ? 'In Range' : status === 'warning' ? 'Monitor' : status === 'critical' ? 'Needs Action' : 'Not Tested'
  const statusColor = status === 'ok' ? 'ok' : status === 'warning' ? 'warning' : 'critical'
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: th.textPrimary }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {value !== null && (
            <span style={{ fontSize: 17, fontWeight: 800, color: barColor }}>
              {value % 1 === 0 ? value : value.toFixed(1)}{' '}
              <span style={{ fontSize: 12, fontWeight: 500, color: th.textSecondary }}>{unit}</span>
            </span>
          )}
          <StatusBadge label={statusLabel} color={status === 'unknown' ? 'ok' : statusColor as 'ok' | 'warning' | 'critical'} />
        </div>
      </div>
      <div style={{ height: 6, background: th.border, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 3, transition: 'width 0.4s' }} />
      </div>
      <div style={{ fontSize: 11, color: th.textSecondary, marginTop: 3 }}>Ideal: {ideal}</div>
    </div>
  )
}

// ─── Icons ───────────────────────────────────────────────────────────────────

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

// ─── Parameter helpers ────────────────────────────────────────────────────────

type ParamStatus = 'ok' | 'warning' | 'critical' | 'unknown'

function getParamStatus(value: number | null, goodLo: number, goodHi: number, warnLo: number, warnHi: number): ParamStatus {
  if (value === null) return 'unknown'
  if (value >= goodLo && value <= goodHi) return 'ok'
  if (value >= warnLo && value <= warnHi) return 'warning'
  return 'critical'
}

function clampPct(value: number | null, lo: number, hi: number): number {
  if (value === null) return 0
  return Math.min(100, Math.max(0, ((value - lo) / (hi - lo)) * 100))
}

// Param display config
const REPORT_PARAMS = [
  { key: 'free_chlorine',    label: 'Free Chlorine',    unit: 'ppm', goodLo: 1,   goodHi: 3,   warnLo: 0.5, warnHi: 5,   displayMin: 0,  displayMax: 6,   ideal: '1 – 3 ppm'      },
  { key: 'total_alkalinity', label: 'Total Alkalinity', unit: 'ppm', goodLo: 80,  goodHi: 120, warnLo: 60,  warnHi: 140, displayMin: 40, displayMax: 180, ideal: '80 – 120 ppm'   },
  { key: 'ph',               label: 'pH',               unit: '',    goodLo: 7.2, goodHi: 7.6, warnLo: 7.0, warnHi: 7.8, displayMin: 6.8,displayMax: 8.2, ideal: '7.2 – 7.6'      },
  { key: 'cya',              label: 'Cyanuric Acid',    unit: 'ppm', goodLo: 30,  goodHi: 50,  warnLo: 20,  warnHi: 80,  displayMin: 0,  displayMax: 80,  ideal: '30 – 50 ppm'    },
  { key: 'calcium_hardness', label: 'Calcium Hardness', unit: 'ppm', goodLo: 200, goodHi: 400, warnLo: 150, warnHi: 600, displayMin: 0,  displayMax: 600, ideal: '200 – 400 ppm'  },
]

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser]                 = useState<User | null>(null)
  const [pool, setPool]                 = useState<{ id: string; name: string; remind_after_days: number | null; volume_gallons: number; type: string } | null>(null)
  const [allPools, setAllPools]         = useState<{ id: string; name: string; remind_after_days: number | null; volume_gallons: number; type: string }[]>([])
  const [showPicker, setShowPicker]     = useState(false)
  const [isPro, setIsPro]               = useState(false)
  const [lastTest, setLastTest]         = useState<TestResult | null>(null)
  const [loading, setLoading]           = useState(true)
  const [remindDays, setRemindDays]     = useState<number | null>(null)
  const [savingReminder, setSavingReminder] = useState(false)
  const [showToast, setShowToast]           = useState(false)
  const [showUpgradeToast, setShowUpgradeToast] = useState(false)
  const [expandedSteps, setExpandedSteps]   = useState<Set<number>>(new Set())
  const [whyOpen, setWhyOpen]               = useState(false)
  const [notLoggedOpen, setNotLoggedOpen]   = useState(false)
  const [liveRecs, setLiveRecs]             = useState<TestResult['recommendations'] | null>(null)
  const [displayScore, setDisplayScore]     = useState(0)

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
      const { data: tests } = await supabase
        .from('test_results')
        .select('health_score,recommendations,created_at,ph,free_chlorine,total_alkalinity,cya,calcium_hardness,salt')
        .eq('pool_id', active.id)
        .order('created_at', { ascending: false })
        .limit(1)
      if (tests && tests.length > 0) setLastTest(tests[0])
      setLoading(false)
    })
  }, [router])

  useEffect(() => {
    if (!lastTest || !pool) { setLiveRecs(null); return }
    const input: TestInput = {
      ph: lastTest.ph,
      free_chlorine: lastTest.free_chlorine,
      total_alkalinity: lastTest.total_alkalinity,
      cya: lastTest.cya,
      calcium_hardness: lastTest.calcium_hardness,
      salt: lastTest.salt,
    }
    const result = calculateRecommendations(input, pool.volume_gallons, pool.type)
    setLiveRecs(result as TestResult['recommendations'])
  }, [lastTest, pool])

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
    setLiveRecs(null)
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

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: th.bg, minHeight: '100vh', maxWidth: 420, margin: '0 auto' }}>
        <div style={{ background: `linear-gradient(160deg, ${th.navy} 0%, #1A4A6E 100%)`, padding: '48px 20px 36px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ height: 22, width: 140, background: 'rgba(255,255,255,0.15)', borderRadius: 20, margin: '0 auto 12px' }} />
            <div style={{ height: 14, width: 200, background: 'rgba(255,255,255,0.1)', borderRadius: 8, margin: '0 auto 8px' }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 16 }}>
              {[120, 140, 100].map((w, i) => <div key={i} style={{ height: 22, width: w, background: 'rgba(255,255,255,0.12)', borderRadius: 20 }} />)}
            </div>
          </div>
        </div>
        <div style={{ padding: 16 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 90, background: '#fff', borderRadius: 16, marginBottom: 10, border: `1px solid ${th.border}` }} />
          ))}
        </div>
      </div>
    )
  }

  // ── Computed values ─────────────────────────────────────────────────────────
  const recs        = liveRecs ?? lastTest?.recommendations
  const score       = recs ? computeScore(recs) : null
  const hasActions  = (recs?.action.filter(r => r.param !== 'calcium').length ?? 0) > 0
  const needsAction = score !== null && score < 75
  const isUnsafe    = (lastTest?.free_chlorine ?? 99) < 0.5

  const treatmentSteps = (recs?.treatment_plan ?? []).filter((s: TreatmentStep) => s.param !== 'calcium')
  const unknownParams   = recs?.unknown.filter(u => u.param !== 'salt' && u.param !== 'calcium') ?? []
  const testedCount     = 5 - (recs?.unknown.filter(u => u.param !== 'salt').length ?? 0)

  // Header status pills from actual values
  const headerPills: { label: string; color: 'critical' | 'warning' | 'ok' }[] = []
  if (lastTest) {
    const fc = lastTest.free_chlorine
    const ph = lastTest.ph
    const ta = lastTest.total_alkalinity
    if (fc !== null) {
      const s = getParamStatus(fc, 1, 3, 0.5, 5)
      headerPills.push({ label: `Chlorine: ${fc} ppm`, color: s === 'ok' ? 'ok' : s === 'warning' ? 'warning' : 'critical' })
    }
    if (ta !== null) {
      const s = getParamStatus(ta, 80, 120, 60, 140)
      headerPills.push({ label: `Alkalinity: ${ta} ppm`, color: s === 'ok' ? 'ok' : s === 'warning' ? 'warning' : 'critical' })
    }
    if (ph !== null) {
      const s = getParamStatus(ph, 7.2, 7.6, 7.0, 7.8)
      headerPills.push({ label: `pH: ${ph % 1 === 0 ? ph : ph.toFixed(1)}`, color: s === 'ok' ? 'ok' : s === 'warning' ? 'warning' : 'critical' })
    }
  }

  const month = new Date().getMonth()
  const isPeakSeason = month >= 4 && month <= 8
  const quickDays = isPeakSeason ? '2–3' : '4–5'
  const fullDays  = isPeakSeason ? '7'   : '10–14'

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: th.bg, minHeight: '100vh', maxWidth: 420, margin: '0 auto' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(160deg, ${th.navy} 0%, #1A4A6E 100%)`,
        padding: '48px 20px 36px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Wave bg */}
        <div style={{ position: 'absolute', bottom: -10, left: 0, right: 0, height: 40, background: th.bg, borderRadius: '50% 50% 0 0 / 100% 100% 0 0' }} />

        {/* Logo + sign out row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg viewBox="28 8 144 175" width="16" height="22" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="hg2" x1=".35" y1="0" x2=".65" y2="1"><stop offset="0%" stopColor="#92D5F5"/><stop offset="42%" stopColor="#3A8AC8"/><stop offset="100%" stopColor="#052C4E"/></linearGradient>
                <clipPath id="hc2"><path d="M100 8C100 8 28 88 28 124C28 163 61 183 100 183C139 183 172 163 172 124C172 88 100 8 100 8Z"/></clipPath>
              </defs>
              <path d="M100 8C100 8 28 88 28 124C28 163 61 183 100 183C139 183 172 163 172 124C172 88 100 8 100 8Z" fill="url(#hg2)"/>
              <g clipPath="url(#hc2)" fill="none" stroke="white" strokeLinecap="round">
                <path d="M46 145Q100 122 154 145" strokeWidth="5" opacity=".8"/>
                <path d="M38 160Q100 136 162 160" strokeWidth="4.5" opacity=".6"/>
                <path d="M50 173Q100 152 150 173" strokeWidth="4" opacity=".4"/>
              </g>
            </svg>
            <span style={{ color: 'white', fontSize: 16, fontFamily: "'Space Grotesk',sans-serif", fontWeight: 300, letterSpacing: '-.01em' }}>
              Pool<span style={{ fontWeight: 800 }}>Keep</span>
            </span>
            {isPro && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(0,224,176,0.18)', color: '#00E0B0' }}>Pro</span>
            )}
          </div>
          <button onClick={handleSignOut} style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer' }}>Sign out</button>
        </div>

        {/* Pool switcher */}
        <div style={{ marginBottom: 16, position: 'relative' }}>
          <button
            onClick={() => setShowPicker(p => !p)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: '6px 14px', border: 'none', cursor: 'pointer' }}
          >
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: th.teal }} />
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 500 }}>
              {pool?.name ?? 'My Pool'} · {lastTest ? `Last tested ${timeAgo(lastTest.created_at)}` : 'No tests yet'}
            </span>
            {allPools.length > 1 && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points={showPicker ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
              </svg>
            )}
          </button>
          {showPicker && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6, background: '#fff', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden', zIndex: 30 }}>
              {allPools.map(p => (
                <button
                  key={p.id}
                  onClick={() => switchPool(p)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'none', border: 'none', borderBottom: `1px solid ${th.border}`, cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.id === pool?.id ? th.teal : th.border }} />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: th.textPrimary }}>{p.name}</span>
                  {p.id === pool?.id && <IconCheck size={14} style={{ color: th.teal }} />}
                </button>
              ))}
              <button
                onClick={() => { setShowPicker(false); router.push('/pool/edit') }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'none', border: 'none', borderTop: `1px solid ${th.border}`, cursor: 'pointer', color: th.blue, fontSize: 14, fontWeight: 500 }}
              >
                Edit Pool
              </button>
              <button
                onClick={() => { setShowPicker(false); router.push(isPro || allPools.length === 0 ? '/setup/pool' : '/pro') }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'none', border: 'none', borderTop: `1px solid ${th.border}`, cursor: 'pointer', color: th.blue, fontSize: 14, fontWeight: 500 }}
              >
                <span>Add Pool</span>
                {!isPro && allPools.length >= 1 && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(0,224,176,0.15)', color: '#00967A' }}>Pro</span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Status summary + health score */}
        <div style={{ textAlign: 'center', position: 'relative' }}>
          {lastTest ? (
            <>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: needsAction ? 'rgba(214,64,69,0.18)' : 'rgba(26,140,126,0.18)',
                borderRadius: 20, padding: '5px 14px', marginBottom: 8,
              }}>
                <span style={{ fontSize: 14, color: needsAction ? '#FF8A8E' : '#6EEAE0', fontWeight: 700 }}>
                  {needsAction ? '⚠ Action Required' : '✓ ' + scoreLabel(score!)}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>
                Based on {testedCount} of 5 parameters ·{' '}
                <span
                  style={{ color: th.teal, cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => router.push('/log')}
                >
                  log more →
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
                {headerPills.map((pill, i) => (
                  <StatusBadge key={i} label={pill.label} color={pill.color} />
                ))}
              </div>

              {/* Water-fill health score circle */}
              {(() => {
                const excellent = score !== null && score >= 90
                const waterDeep = excellent ? 'rgba(0,90,160,0.55)' : 'rgba(0,80,150,0.50)'
                const waveFront = excellent ? 'rgba(0,190,255,0.75)' : 'rgba(0,168,240,0.72)'
                const waveBack  = excellent ? 'rgba(0,150,220,0.45)' : 'rgba(0,140,210,0.42)'
                const fillH  = score !== null ? Math.round(116 * displayScore / 100) : 0
                const offsetY = 116 - fillH
                const glowColor = score !== null && score >= 75 ? 'rgba(41,184,232,0.40)' : score !== null && score >= 50 ? 'rgba(91,200,245,0.35)' : 'rgba(168,216,234,0.30)'
                const dotColor  = score !== null && score >= 75 ? '#29B8E8' : score !== null && score >= 50 ? '#5BC8F5' : '#A8D8EA'
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 20 }}>
                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 12 }}>Health Score</p>
                    <div style={{ position: 'relative', width: 160, height: 160 }}>
                      <svg width="160" height="160" viewBox="0 0 160 160" style={{ position: 'absolute', top: 0, left: 0 }}>
                        <defs>
                          <clipPath id="scoreClip2"><circle cx="80" cy="80" r="58"/></clipPath>
                        </defs>
                        <circle cx="80" cy="80" r="62" fill="none" stroke="rgba(0,160,230,0.18)" strokeWidth="8"/>
                        <circle cx="80" cy="80" r="59" fill="rgba(0,20,45,0.85)" stroke="rgba(0,170,240,0.65)" strokeWidth="3"/>
                        {score !== null && (
                          <g clipPath="url(#scoreClip2)">
                            <rect x="22" y="22" width="116" height="116" fill={waterDeep}
                              style={{ transform: `translateY(${offsetY}px)`, transition: 'transform 1.5s cubic-bezier(0.4,0,0.2,1)' }}
                            />
                            <g style={{ transform: `translateY(${offsetY}px)`, transition: 'transform 1.5s cubic-bezier(0.4,0,0.2,1)' }}>
                              <path d="M-92,20 Q-64,13 -36,20 Q-8,27 20,20 Q48,13 76,20 Q104,27 132,20 Q160,13 188,20 Q216,27 244,20 Q272,13 300,20 L300,33 L-92,33 Z"
                                fill={waveFront} style={{ animation: 'waveSurface 3s linear infinite' }} />
                            </g>
                            <g style={{ transform: `translateY(${offsetY + 5}px)`, transition: 'transform 1.5s cubic-bezier(0.4,0,0.2,1)' }}>
                              <path d="M-92,20 Q-64,27 -36,20 Q-8,13 20,20 Q48,27 76,20 Q104,13 132,20 Q160,27 188,20 Q216,13 244,20 L244,33 L-92,33 Z"
                                fill={waveBack} style={{ animation: 'waveSurface 4.5s linear infinite reverse' }} />
                            </g>
                          </g>
                        )}
                        <circle cx="80" cy="80" r="59" fill="none" stroke="rgba(0,170,240,0.65)" strokeWidth="3"/>
                      </svg>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <p style={{
                          fontSize: 80, fontWeight: 700, color: 'white', lineHeight: 1,
                          fontFamily: "'Oswald',sans-serif", letterSpacing: '-3px',
                          textShadow: '0 2px 20px rgba(0,0,0,0.6)',
                        }}>
                          {score ?? '—'}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: dotColor, boxShadow: `0 0 8px ${glowColor}, 0 0 16px ${glowColor}` }} />
                      <span style={{ fontSize: 16, fontWeight: 700, color: dotColor, textShadow: `0 0 20px ${glowColor}` }}>
                        {score !== null ? scoreLabel(score) : 'Log your first test'}
                      </span>
                    </div>
                  </div>
                )
              })()}
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
                Welcome, {user?.user_metadata?.full_name?.split(' ')[0] || 'there'}!
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
                Log your first test
              </div>
              <button
                onClick={() => router.push('/log')}
                style={{ background: th.teal, color: '#fff', border: 'none', borderRadius: 24, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}
              >
                Log a Test
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: '16px 16px 100px' }}>

        {/* DO NOT SWIM banner */}
        {isUnsafe && (
          <div style={{
            background: th.redLight, border: `1.5px solid ${th.red}`,
            borderRadius: 12, padding: '12px 16px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>🚫</span>
            <div>
              <div style={{ fontWeight: 800, color: th.red, fontSize: 14 }}>DO NOT SWIM</div>
              <div style={{ fontSize: 13, color: th.red, opacity: 0.85 }}>
                Free chlorine at {lastTest?.free_chlorine ?? 0} ppm — unsafe until treated
              </div>
            </div>
          </div>
        )}

        {lastTest && recs ? (
          <>
            {/* ── Treatment Plan ───────────────────────────────────────────── */}
            {treatmentSteps.length > 0 && (
              <>
                <SectionLabel>Treatment Plan — Do Today</SectionLabel>

                {treatmentSteps.map((step, i) => {
                  const stepColor = step.urgency === 'routine' ? th.amber : th.red
                  const isExpanded = expandedSteps.has(step.step)
                  const toggleExpand = () => setExpandedSteps(prev => {
                    const next = new Set(prev)
                    next.has(step.step) ? next.delete(step.step) : next.add(step.step)
                    return next
                  })

                  // Parse multi-chemical options (separated by \n)
                  const chemLines   = step.chemical ? step.chemical.split('\n') : []
                  const amountLines = step.amount   ? step.amount.split('\n')   : []
                  const isMultiChem = chemLines.length > 1

                  return (
                    <Card key={step.step} style={{ borderLeft: `4px solid ${stepColor}`, padding: 0, overflow: 'hidden' }}>
                      {/* Header row */}
                      <div style={{ padding: '16px 18px 12px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <StepBadge n={step.step} color={stepColor} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: th.textPrimary, lineHeight: 1.3 }}>
                            {step.title}
                          </div>
                          {step.how && (() => {
                            const paras = step.how.split('\n\n').map((s: string) => s.trim()).filter(Boolean)
                            const last = paras[paras.length - 1].replace(/^Step \d+\s*[—–-]\s*/, '')
                            const cut = last.length <= 280 ? last : last.slice(0, 280).replace(/\s+\S+$/, '') + '…'
                            return <div style={{ fontSize: 13, color: th.textSecondary, marginTop: 4, lineHeight: 1.5 }}>{cut}</div>
                          })()}
                        </div>
                      </div>

                      {/* Dose box */}
                      {chemLines.length > 0 && (
                        <div style={{ background: th.blueLight, margin: '0 18px 12px', borderRadius: 10, padding: '10px 12px' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: th.blue, marginBottom: 6 }}>
                            DOSE{isMultiChem ? ' — IN ORDER' : ''}
                          </div>
                          {isMultiChem ? (
                            chemLines.map((chem: string, ci: number) => (
                              <div key={ci} style={{ marginBottom: ci < chemLines.length - 1 ? 8 : 0 }}>
                                <div style={{ fontSize: 14, color: th.textPrimary, fontWeight: 600 }}>{chem}</div>
                                {amountLines[ci] && (
                                  <div style={{ fontSize: 13, color: th.textSecondary }}>{amountLines[ci]}</div>
                                )}
                              </div>
                            ))
                          ) : (
                            <div>
                              <div style={{ fontSize: 14, color: th.textPrimary, fontWeight: 600 }}>{chemLines[0]}</div>
                              {amountLines[0] && (
                                <div style={{ fontSize: 13, color: th.textSecondary }}>{amountLines[0]}</div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Wait-after note */}
                      {step.waitAfter && (
                        <div style={{ fontSize: 12, color: th.teal, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, padding: '0 18px 12px' }}>
                          <span>⏱</span> {step.waitAfter}
                        </div>
                      )}

                      {/* Expand toggle */}
                      <button
                        onClick={toggleExpand}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 18px', background: isExpanded ? '#F8FBFD' : 'transparent',
                          border: 'none', borderTop: `1px solid ${th.border}`, cursor: 'pointer',
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 600, color: th.blue }}>
                          {isExpanded ? 'Hide details' : 'Why + full instructions'}
                        </span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={th.blue} strokeWidth="2.5" strokeLinecap="round" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </button>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div style={{ padding: '12px 18px 16px', borderTop: `1px solid ${th.border}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: th.blue, marginBottom: 4 }}>Why</div>
                            <div style={{ fontSize: 12, color: th.textSecondary, lineHeight: 1.6 }}>{step.why}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: th.blue, marginBottom: 4 }}>How to apply</div>
                            {step.how.split('\n\n').filter(Boolean).map((block: string, idx: number) => {
                              const m = block.trim().match(/^(Step \d+)\s*[—–-]\s*([\s\S]+)$/)
                              return m ? (
                                <div key={idx} style={{ marginBottom: 8 }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: th.textPrimary }}>{m[1]}</div>
                                  <div style={{ fontSize: 12, color: th.textSecondary, lineHeight: 1.6 }}>{m[2]}</div>
                                </div>
                              ) : (
                                <div key={idx} style={{ fontSize: 12, color: th.textSecondary, lineHeight: 1.6, marginBottom: 6 }}>{block.trim()}</div>
                              )
                            })}
                          </div>
                          {step.lookFor && (
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: th.blue, marginBottom: 4 }}>What to look for</div>
                              <div style={{ fontSize: 12, color: th.textSecondary, lineHeight: 1.6 }}>{step.lookFor}</div>
                            </div>
                          )}
                          {step.note && (
                            <div style={{ background: th.amberLight, borderRadius: 10, padding: '8px 12px', display: 'flex', gap: 8 }}>
                              <span style={{ fontSize: 14 }}>⚠</span>
                              <div style={{ fontSize: 12, color: '#7A4A00', lineHeight: 1.6 }}>{step.note}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  )
                })}

                {/* Why this order? */}
                {treatmentSteps.length > 1 && (
                  <>
                    <div
                      onClick={() => setWhyOpen(o => !o)}
                      style={{ fontSize: 13, color: th.teal, fontWeight: 700, cursor: 'pointer', padding: '6px 4px', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}
                    >
                      {whyOpen ? '▾' : '▸'} Why this order?
                    </div>
                    {whyOpen && (
                      <Card style={{ background: th.tealLight, border: `1px solid ${th.teal}30` }}>
                        <div style={{ fontSize: 13, color: th.textPrimary, lineHeight: 1.6 }}>
                          Each step creates the right conditions for the next. Adding acid before chlorine makes shock 2–3× more effective at the lower pH. Aeration afterward raises pH back naturally without adding chemicals, which also helps lower alkalinity over time.
                        </div>
                      </Card>
                    )}
                  </>
                )}

                {/* After treatment */}
                <div style={{ marginTop: 20, marginBottom: 12 }}>
                  <SectionLabel>After Treatment</SectionLabel>
                </div>
                <Card>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 22 }}>🔁</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: th.textPrimary }}>Retest pH + chlorine in {quickDays} days</div>
                      <div style={{ fontSize: 13, color: th.textSecondary }}>No full strip needed — just confirm it worked. Full panel retest in {fullDays} days.</div>
                    </div>
                  </div>
                </Card>
              </>
            )}

            {/* Pool all-good state */}
            {treatmentSteps.length === 0 && !hasActions && (
              <Card>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(26,140,126,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <IconCheck size={22} style={{ color: th.teal }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: th.textPrimary }}>Your pool looks great</div>
                    <div style={{ fontSize: 13, color: th.textSecondary, marginTop: 2 }}>All tested parameters are in range — no action needed.</div>
                  </div>
                </div>
              </Card>
            )}

            {/* ── Water Report ──────────────────────────────────────────────── */}
            <div style={{ marginTop: 20, marginBottom: 12 }}>
              <SectionLabel>
                Water Report · {new Date(lastTest.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </SectionLabel>
            </div>

            <Card>
              {REPORT_PARAMS.map((p, i) => {
                const raw = lastTest[p.key as keyof TestResult] as number | null
                // Map report key → recs param name
                const recParam: Record<string, string> = {
                  free_chlorine:    'chlorine',
                  total_alkalinity: 'alkalinity',
                  ph:               'ph',
                  cya:              'cya',
                  calcium_hardness: 'calcium',
                }
                const rp = recParam[p.key]
                // Drive status from the recommendations engine so Water Report
                // and Looking Good / Treatment Plan always agree
                let status: ParamStatus
                if (raw === null) {
                  status = 'unknown'
                } else if (recs.action.some(r => r.param === rp)) {
                  status = 'critical'
                } else if (recs.monitor.some(r => r.param === rp)) {
                  status = 'warning'
                } else if (recs.good.some(r => r.param === rp)) {
                  status = 'ok'
                } else {
                  status = getParamStatus(raw, p.goodLo, p.goodHi, p.warnLo, p.warnHi)
                }
                const pct = clampPct(raw, p.displayMin, p.displayMax)
                return (
                  <React.Fragment key={p.key}>
                    {i > 0 && <Divider />}
                    <WaterParam
                      label={p.label}
                      value={raw}
                      unit={p.unit}
                      status={status}
                      ideal={p.ideal}
                      pct={pct}
                    />
                  </React.Fragment>
                )
              })}
            </Card>

            {/* Not yet logged */}
            {unknownParams.length > 0 && (
              <>
                <div
                  onClick={() => setNotLoggedOpen(o => !o)}
                  style={{ fontSize: 13, color: th.textSecondary, fontWeight: 600, cursor: 'pointer', padding: '4px 4px', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}
                >
                  {notLoggedOpen ? '▾' : '▸'} {unknownParams.length} parameter{unknownParams.length !== 1 ? 's' : ''} not yet logged
                </div>
                {notLoggedOpen && (
                  <div style={{ marginBottom: 8 }}>
                    {unknownParams.map((u, i) => (
                      <Card key={i} style={{ opacity: 0.75 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: th.textPrimary }}>{u.title}</div>
                        <div style={{ fontSize: 13, color: th.textSecondary, marginTop: 4 }}>{u.desc}</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                          {u.tags.map((t: string) => (
                            <span key={t} style={{ fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20, background: th.bg, color: th.textSecondary }}>{t}</span>
                          ))}
                        </div>
                      </Card>
                    ))}
                    <button
                      onClick={() => router.push('/log')}
                      style={{ width: '100%', padding: '12px', background: th.teal, color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 8 }}
                    >
                      Log remaining parameters
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ── Looking Good (if any) ─────────────────────────────────────── */}
            {(() => {
              const phNeedsPrep = (lastTest.free_chlorine ?? 99) < 0.5 && (lastTest.ph ?? 0) > 7.2
              const goodItems = recs.good.filter(g => !(g.param === 'ph' && phNeedsPrep) && g.param !== 'calcium')
              return goodItems.length > 0 ? (
                <div style={{ marginTop: 20, marginBottom: 12 }}>
                  <SectionLabel>Looking Good</SectionLabel>
                  {goodItems.map((a, i) => (
                    <Card key={i}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(26,140,126,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <IconCheck size={17} style={{ color: th.teal }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: th.textPrimary }}>{a.title}</div>
                          <div style={{ fontSize: 13, color: th.textSecondary, marginTop: 2 }}>{a.desc}</div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : null
            })()}
          </>
        ) : (
          /* No test yet */
          <Card>
            <div style={{ fontSize: 15, fontWeight: 700, color: th.textPrimary, marginBottom: 8 }}>Log your first test</div>
            <div style={{ fontSize: 13, color: th.textSecondary, marginBottom: 16 }}>
              Get a health score and personalized treatment plan based on your pool&apos;s chemistry.
            </div>
            <button
              onClick={() => router.push('/log')}
              style={{ width: '100%', padding: '14px', background: th.blue, color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >
              Log My First Test
            </button>
          </Card>
        )}

        {/* ── Reminder settings ────────────────────────────────────────────── */}
        <div style={{ marginTop: 20 }}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: th.blueLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={th.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: th.textPrimary }}>Test Reminders</div>
                <div style={{ fontSize: 12, color: th.textSecondary }}>Email me if I forget to test</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {([null, 3, 7, 14] as (number | null)[]).map(days => (
                <button
                  key={days ?? 'off'}
                  onClick={() => saveReminderDays(days)}
                  disabled={savingReminder}
                  style={{
                    flex: 1, padding: '8px 0', fontSize: 12, fontWeight: 700, borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: remindDays === days ? th.blue : th.bg,
                    color: remindDays === days ? '#fff' : th.textSecondary,
                  }}
                >
                  {days === null ? 'Off' : `${days}d`}
                </button>
              ))}
            </div>
            {remindDays !== null && (
              <div style={{ fontSize: 11, color: th.textSecondary, marginTop: 8, textAlign: 'center' }}>
                You&apos;ll get an email if {pool?.name ?? 'your pool'} goes {remindDays} days without a test
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── Bottom tab bar ───────────────────────────────────────────────────── */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: `1px solid ${th.border}`, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '8px 8px', maxWidth: 480, margin: '0 auto' }}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: <IconDashboard /> },
            { id: 'history',   label: 'History',   icon: <IconHistory />   },
            { id: 'log',       label: '',           icon: null              },
            { id: 'share',     label: 'Share',      icon: <IconShare />     },
            { id: 'pro',       label: 'Account',    icon: <IconPro />       },
          ].map(tab => {
            if (tab.id === 'log') return (
              <button
                key="log"
                onClick={() => router.push('/log')}
                style={{ width: 56, height: 56, borderRadius: '50%', background: th.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '4px solid #fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', marginTop: -20, cursor: 'pointer' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            )
            const active = tab.id === 'dashboard'
            return (
              <button
                key={tab.id}
                onClick={() => router.push(`/${tab.id}`)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '4px 12px', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <span style={{ color: active ? th.blue : th.textSecondary }}>{tab.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 500, color: active ? th.blue : th.textSecondary }}>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Toast — test logged ──────────────────────────────────────────────── */}
      {showToast && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 100,
          background: th.teal, color: '#fff', padding: '12px 20px', borderRadius: 16,
          fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)', maxWidth: 320, width: 'calc(100% - 32px)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Test logged — your score is updated
        </div>
      )}

      {/* ── Toast — upgraded ─────────────────────────────────────────────────── */}
      {showUpgradeToast && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 100,
          background: `linear-gradient(135deg, ${th.navy}, #005A52)`, border: '1px solid rgba(0,224,176,0.3)',
          color: '#fff', padding: '14px 20px', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)', maxWidth: 340, width: 'calc(100% - 32px)',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(0,224,176,0.2)" stroke="#00E0B0" strokeWidth="1.6" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M2 9l10 13L22 9 16 3H8L2 9z"/>
            <path d="M2 9h20M8 3l4 6 4-6" strokeLinecap="round"/>
          </svg>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Welcome to PoolKeep Pro!</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Your account has been upgraded.</div>
          </div>
        </div>
      )}
    </div>
  )
}
