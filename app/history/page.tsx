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

type ParamKey = 'ph' | 'free_chlorine' | 'total_alkalinity' | 'cya' | 'calcium_hardness' | 'salt'

const PARAM_CONFIG: {
  key: ParamKey; label: string; unit: string
  idealMin: number; idealMax: number; viewMin: number; viewMax: number
  decimals: number; color: string
}[] = [
  { key: 'ph', label: 'pH', unit: '', idealMin: 7.4, idealMax: 7.6, viewMin: 6.8, viewMax: 8.4, decimals: 1, color: '#0078B8' },
  { key: 'free_chlorine', label: 'Free Chlorine', unit: 'ppm', idealMin: 1, idealMax: 3, viewMin: 0, viewMax: 6, decimals: 1, color: '#1DB869' },
  { key: 'total_alkalinity', label: 'Alkalinity', unit: 'ppm', idealMin: 80, idealMax: 120, viewMin: 40, viewMax: 180, decimals: 0, color: '#9B59B6' },
  { key: 'cya', label: 'CYA', unit: 'ppm', idealMin: 30, idealMax: 50, viewMin: 0, viewMax: 120, decimals: 0, color: '#F59E0B' },
  { key: 'calcium_hardness', label: 'Calcium', unit: 'ppm', idealMin: 200, idealMax: 400, viewMin: 100, viewMax: 600, decimals: 0, color: '#E5304A' },
  { key: 'salt', label: 'Salt', unit: 'ppm', idealMin: 2700, idealMax: 3400, viewMin: 2000, viewMax: 5000, decimals: 0, color: '#8B5CF6' },
]

function chartX(i: number, total: number, width: number) {
  return total <= 1 ? width / 2 : (i / (total - 1)) * width
}
function chartY(val: number, vMin: number, vMax: number, height: number) {
  return height - ((val - vMin) / (vMax - vMin)) * height
}
function makePath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return ''
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
}

export default function HistoryPage() {
  const router = useRouter()
  const [tests, setTests] = useState<TestResult[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [pool, setPool] = useState<{ name: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'trends' | 'log'>('trends')
  const [isPro, setIsPro] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      const [{ data: profile }, poolsRes] = await Promise.all([
        supabase.from('profiles').select('subscription_status').eq('id', data.user.id).single(),
        supabase.from('pools').select('id,name').order('created_at', { ascending: true }),
      ])
      const pro = profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing'
      setIsPro(pro)
      const pools = poolsRes.data
      if (!pools || pools.length === 0) { router.push('/setup/pool'); return }
      const savedId = typeof window !== 'undefined' ? localStorage.getItem('poolkeep_active_pool') : null
      const activePool = (savedId && pools.find(p => p.id === savedId)) || pools[0]
      setPool(activePool)
      const { data: results } = await supabase
        .from('test_results')
        .select('id,tested_at,health_score,ph,free_chlorine,total_alkalinity,cya,calcium_hardness,salt,recommendations')
        .eq('pool_id', activePool.id)
        .order('tested_at', { ascending: false })
        .limit(pro ? 200 : 10)
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

  const chronTests = [...tests].reverse()

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

      {/* Tab switcher */}
      <div className="bg-surface px-4 pt-3 pb-1 flex gap-2">
        <button
          onClick={() => setActiveTab('trends')}
          className="flex-1 py-2 text-xs font-bold rounded-xl transition-all"
          style={activeTab === 'trends' ? {background:'#003D5C',color:'white'} : {background:'#F0F6FA',color:'#8AAABB'}}
        >
          Trends
        </button>
        <button
          onClick={() => setActiveTab('log')}
          className="flex-1 py-2 text-xs font-bold rounded-xl transition-all"
          style={activeTab === 'log' ? {background:'#003D5C',color:'white'} : {background:'#F0F6FA',color:'#8AAABB'}}
        >
          Log ({tests.length})
        </button>
      </div>

      {/* Trends tab */}
      {activeTab === 'trends' && (
        <div className="flex-1 px-4 pt-4 pb-24 bg-surface space-y-4">
          {tests.length < 2 ? (
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center mt-2">
              <p className="text-text-primary font-semibold mb-1">Not enough data yet</p>
              <p className="text-text-muted text-sm mb-4">Log at least 2 tests to see your trend charts.</p>
              <button onClick={() => router.push('/log')} className="bg-pool-dark text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity">
                Log a Test →
              </button>
            </div>
          ) : (
            <>
              {/* Health Score Chart */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3">Health Score Over Time</p>
                {(() => {
                  const W = 400, H = 90
                  return (
                    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{overflow:'visible'}}>
                      {/* Zone bands — top=100, bottom=0 */}
                      <rect x="0" y="0" width={W} height={chartY(90,0,100,H)} fill="rgba(229,48,74,0.06)" rx="2"/>
                      <rect x="0" y={chartY(90,0,100,H)} width={W} height={chartY(75,0,100,H)-chartY(90,0,100,H)} fill="rgba(245,166,35,0.06)" rx="2"/>
                      <rect x="0" y={chartY(75,0,100,H)} width={W} height={chartY(55,0,100,H)-chartY(75,0,100,H)} fill="rgba(0,120,184,0.05)" rx="2"/>
                      <rect x="0" y={chartY(55,0,100,H)} width={W} height={H-chartY(55,0,100,H)} fill="rgba(29,184,105,0.07)" rx="2"/>
                      {/* Zone labels */}
                      <text x={W-2} y="8" textAnchor="end" fontSize="7.5" fill="rgba(229,48,74,0.5)" fontWeight="600">Poor</text>
                      <text x={W-2} y={chartY(82,0,100,H)+4} textAnchor="end" fontSize="7.5" fill="rgba(212,136,0,0.55)">Fair</text>
                      <text x={W-2} y={chartY(83,0,100,H)-8} textAnchor="end" fontSize="7.5" fill="rgba(0,120,184,0.55)">Good</text>
                      <text x={W-2} y={H-2} textAnchor="end" fontSize="7.5" fill="rgba(29,184,105,0.65)" fontWeight="600">Excellent</text>
                      {/* Trend line */}
                      <path
                        d={makePath(chronTests.map((t,i) => ({x: chartX(i, chronTests.length, W), y: chartY(t.health_score, 0, 100, H)})))}
                        fill="none" stroke="#0078B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      />
                      {/* Score dots + labels */}
                      {chronTests.map((t, i) => {
                        const c = scoreColor(t.health_score)
                        const cx = chartX(i, chronTests.length, W)
                        const cy = chartY(t.health_score, 0, 100, H)
                        const showLabel = i === 0 || i === chronTests.length - 1 || chronTests.length <= 7
                        return (
                          <g key={t.id}>
                            <circle cx={cx} cy={cy} r="4" fill={c.text} stroke="white" strokeWidth="1.5"/>
                            {showLabel && (
                              <text x={cx} y={Math.max(12, cy - 7)} textAnchor="middle" fontSize="9" fill={c.text} fontWeight="700">{t.health_score}</text>
                            )}
                          </g>
                        )
                      })}
                    </svg>
                  )
                })()}
                <div className="flex justify-between mt-2">
                  <span className="text-[9px] text-text-faint">{formatDate(chronTests[0].tested_at)}</span>
                  {chronTests.length > 2 && <span className="text-[9px] text-text-faint">{formatDate(chronTests[Math.floor(chronTests.length / 2)].tested_at)}</span>}
                  <span className="text-[9px] text-text-faint">{formatDate(chronTests[chronTests.length - 1].tested_at)}</span>
                </div>
              </div>

              {/* Parameter sparklines */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3">Parameters</p>
                <div className="grid grid-cols-2 gap-3">
                  {PARAM_CONFIG.map(cfg => {
                    const paramPoints = chronTests
                      .map(t => t[cfg.key] as number | null)
                      .map((val, i) => ({ val, i }))
                      .filter((p): p is { val: number; i: number } => p.val !== null)
                    const latest = paramPoints.length > 0 ? paramPoints[paramPoints.length - 1].val : undefined
                    const inRange = latest !== undefined && latest >= cfg.idealMin && latest <= cfg.idealMax
                    const SW = 180, spH = 68
                    return (
                      <div key={cfg.key} className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{color: cfg.color}}>{cfg.label}</p>
                        <div className="flex items-baseline gap-1 mt-0.5 mb-2">
                          <span className="text-xl font-bold" style={{fontFamily:"'Oswald',sans-serif", lineHeight:1, color: latest === undefined ? '#8AAABB' : inRange ? '#1DB869' : '#E5304A'}}>
                            {latest !== undefined ? (cfg.decimals > 0 ? latest.toFixed(cfg.decimals) : String(latest)) : '—'}
                          </span>
                          {latest !== undefined && cfg.unit && <span className="text-[10px] text-text-faint">{cfg.unit}</span>}
                        </div>
                        {paramPoints.length < 2 ? (
                          <p className="text-[10px] text-text-faint py-2">Log more tests to see trend</p>
                        ) : (
                          <svg viewBox={`0 0 ${SW} ${spH}`} width="100%" style={{overflow:'visible'}}>
                            {/* Ideal range band */}
                            <rect
                              x="0"
                              y={chartY(cfg.idealMax, cfg.viewMin, cfg.viewMax, spH)}
                              width={SW}
                              height={Math.max(0, chartY(cfg.idealMin, cfg.viewMin, cfg.viewMax, spH) - chartY(cfg.idealMax, cfg.viewMin, cfg.viewMax, spH))}
                              fill={`${cfg.color}20`}
                              rx="2"
                            />
                            <line x1="0" x2={SW} y1={chartY(cfg.idealMax, cfg.viewMin, cfg.viewMax, spH)} y2={chartY(cfg.idealMax, cfg.viewMin, cfg.viewMax, spH)} stroke={cfg.color} strokeWidth="0.8" strokeDasharray="3 2" opacity="0.4"/>
                            <line x1="0" x2={SW} y1={chartY(cfg.idealMin, cfg.viewMin, cfg.viewMax, spH)} y2={chartY(cfg.idealMin, cfg.viewMin, cfg.viewMax, spH)} stroke={cfg.color} strokeWidth="0.8" strokeDasharray="3 2" opacity="0.4"/>
                            {/* Trend line */}
                            <path
                              d={makePath(paramPoints.map((p, pi) => ({
                                x: chartX(pi, paramPoints.length, SW),
                                y: Math.max(1, Math.min(spH - 1, chartY(p.val, cfg.viewMin, cfg.viewMax, spH)))
                              })))}
                              fill="none" stroke={cfg.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.9"
                            />
                            {/* Dots */}
                            {paramPoints.map((p, pi) => {
                              const cx = chartX(pi, paramPoints.length, SW)
                              const cy = Math.max(2, Math.min(spH - 2, chartY(p.val, cfg.viewMin, cfg.viewMax, spH)))
                              const ok = p.val >= cfg.idealMin && p.val <= cfg.idealMax
                              return <circle key={pi} cx={cx} cy={cy} r="3" fill={ok ? '#1DB869' : '#E5304A'} stroke="white" strokeWidth="1.5"/>
                            })}
                          </svg>
                        )}
                        <p className="text-[9px] text-text-faint mt-1">Ideal: {cfg.idealMin}–{cfg.idealMax}{cfg.unit ? ` ${cfg.unit}` : ''}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Log tab */}
      {activeTab === 'log' && (
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
              {!isPro && tests.length >= 10 && (
                <div className="bg-white rounded-2xl px-4 py-4 shadow-sm border border-gray-100 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-text-primary">Showing last 10 tests</p>
                    <p className="text-xs text-text-muted mt-0.5">Upgrade to Pro for unlimited history</p>
                  </div>
                  <button onClick={() => router.push('/pro')} className="shrink-0 text-xs font-bold px-3 py-2 rounded-xl text-white" style={{background:'#0078B8'}}>
                    Upgrade
                  </button>
                </div>
              )}
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
      )}

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
