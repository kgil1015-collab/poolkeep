'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const PARAMS = [
  { key: 'ph',               label: 'pH',                  unit: '',    placeholder: '7.4', min: 0,    max: 14,   step: '0.1', range: '7.2 – 7.6' },
  { key: 'free_chlorine',    label: 'Free Chlorine',       unit: 'ppm', placeholder: '—',   min: 0,    max: 20,   step: '0.1', range: '1 – 3 ppm' },
  { key: 'total_alkalinity', label: 'Total Alkalinity',    unit: 'ppm', placeholder: '100', min: 0,    max: 500,  step: '1',   range: '80 – 120 ppm' },
  { key: 'cya',              label: 'Cyanuric Acid (CYA)', unit: 'ppm', placeholder: '40',  min: 0,    max: 300,  step: '1',   range: '30 – 50 ppm' },
  { key: 'calcium_hardness', label: 'Calcium Hardness',    unit: 'ppm', placeholder: '300', min: 0,    max: 1000, step: '1',   range: '200 – 400 ppm' },
  { key: 'salt',             label: 'Salt (salt pools only)', unit: 'ppm', placeholder: '—',   min: 0,    max: 6000, step: '1',   range: '2700 – 3400 ppm · skip if not a salt pool' },
]

const FREE_LIMIT = 5

function NudgeBanner({ count }: { count: number }) {
  const remaining = FREE_LIMIT - count
  const msg = remaining === 1
    ? 'Getting good at this. This is your last free test.'
    : `${count} of ${FREE_LIMIT} free tests used — Pro unlocks unlimited.`
  return (
    <div className="rounded-xl px-4 py-3 mb-4 flex items-center gap-3" style={{background:'rgba(0,120,184,0.07)', border:'1.5px solid rgba(0,120,184,0.18)'}}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2.2" strokeLinecap="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <p className="text-xs font-semibold flex-1" style={{color:'#0078B8'}}>{msg}</p>
      <button
        onClick={() => window.location.href = '/pro'}
        className="text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 text-white"
        style={{background:'#0078B8'}}
      >
        Go Pro
      </button>
    </div>
  )
}

function UpgradeScreen({ poolName }: { poolName: string }) {
  const router = useRouter()
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
        <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-1">{poolName}</p>
        <h1 className="text-white text-2xl font-bold" style={{fontFamily:"'Oswald',sans-serif",letterSpacing:'-.01em'}}>Log a Test</h1>
      </div>

      {/* Wave */}
      <div className="bg-pool-deep">
        <svg viewBox="0 0 480 32" xmlns="http://www.w3.org/2000/svg" className="w-full block" style={{display:'block',marginBottom:-1}}>
          <path d="M0,28 C160,30 300,6 480,12 L480,32 L0,32 Z" fill="#F0F6FA"/>
        </svg>
      </div>

      {/* Upgrade card */}
      <div className="flex-1 px-4 pt-6 pb-10 bg-surface flex flex-col">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-1 flex flex-col">
          {/* Teal top bar */}
          <div className="h-1.5 w-full" style={{background:'linear-gradient(90deg,#00E0B0 0%,#0078B8 60%,#005580 100%)'}} />

          <div className="px-5 pt-6 pb-8 flex flex-col flex-1">
            {/* Icon */}
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{background:'rgba(0,224,176,0.12)'}}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00967A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2C6 8 3 13 3 16a9 9 0 0 0 18 0c0-3-3-8-9-14z"/>
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-text-primary mb-2" style={{fontFamily:"'Oswald',sans-serif"}}>
              Your pool has never looked better.
            </h2>
            <p className="text-text-muted text-sm leading-relaxed mb-6">
              You&apos;ve used all {FREE_LIMIT} free tests — and your water&apos;s cleaner for it. Keep the good chemistry going with Pro.
            </p>

            {/* What you get */}
            <div className="space-y-3 mb-8">
              {[
                'Unlimited water tests',
                'Full trend charts across every test',
                'Manage up to 5 pools',
                'Unlimited history',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{background:'rgba(29,184,105,0.12)'}}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1DB869" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <span className="text-sm font-medium text-text-primary">{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-auto space-y-3">
              <button
                onClick={() => router.push('/pro')}
                className="w-full font-bold py-4 rounded-xl text-sm text-white"
                style={{background:'#0078B8', boxShadow:'0 4px 16px rgba(0,120,184,0.3)'}}
              >
                Keep the Good Chemistry Going →
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full text-sm text-text-muted py-2"
              >
                Go back to dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LogTestPage() {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>({})
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [pool, setPool] = useState<{ id: string; name: string; volume_gallons: number } | null>(null)
  const [poolLoading, setPoolLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [testCount, setTestCount] = useState(0)
  const [isPro, setIsPro] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      const [{ data: profile }, { data: pools }] = await Promise.all([
        supabase.from('profiles').select('subscription_status').eq('id', data.user.id).maybeSingle(),
        supabase.from('pools').select('id,name,volume_gallons').order('created_at', { ascending: true }),
      ])
      const pro = profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing'
      setIsPro(pro)
      if (!pools || pools.length === 0) { router.push('/setup/pool'); return }
      const savedId = localStorage.getItem('poolkeep_active_pool')
      const active = (savedId && pools.find(p => p.id === savedId)) || pools[0]
      localStorage.setItem('poolkeep_active_pool', active.id)
      setPool(active)
      if (!pro) {
        const { count } = await supabase
          .from('test_results')
          .select('id', { count: 'exact', head: true })
          .eq('pool_id', active.id)
        setTestCount(count ?? 0)
      }
      setPoolLoading(false)
    })
  }, [router])

  function set(key: string, val: string) {
    setValues(v => ({ ...v, [key]: val }))
  }

  async function handleSubmit() {
    setError('')
    const parse = (key: string, fn: (v: string) => number) => {
      const v = (values[key] ?? '').trim()
      return v !== '' ? fn(v) : null
    }

    const testInput = {
      ph: parse('ph', parseFloat),
      free_chlorine: parse('free_chlorine', parseFloat),
      total_alkalinity: parse('total_alkalinity', parseInt),
      cya: parse('cya', parseInt),
      calcium_hardness: parse('calcium_hardness', parseInt),
      salt: parse('salt', parseInt),
    }

    const hasAny = Object.values(testInput).some(v => v !== null)
    if (!hasAny) { setError('Enter at least one reading.'); return }
    if (!pool) { setError('Pool not loaded yet — please wait a moment and try again.'); return }
    setLoading(true)

    const res = await fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testInput, poolId: pool.id, volumeGallons: pool.volume_gallons }),
    })

    setLoading(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Failed to save test. Please try again.')
      return
    }
    sessionStorage.setItem('poolkeep_just_logged', '1')
    window.location.href = '/dashboard'
  }

  if (poolLoading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col" style={{maxWidth:480,margin:'0 auto'}}>
        <div className="bg-pool-deep px-5 pt-5 pb-6 animate-pulse">
          <div className="h-5 w-24 rounded-full bg-white/15 mb-6" />
          <div className="h-3 w-20 rounded-full bg-white/15 mb-2" />
          <div className="h-7 w-32 rounded-full bg-white/20" />
        </div>
        <div className="bg-pool-deep"><svg viewBox="0 0 480 32" className="w-full block"><path d="M0,28 C160,30 300,6 480,12 L480,32 L0,32 Z" fill="#F0F6FA"/></svg></div>
        <div className="flex-1 px-4 pt-4 pb-10 animate-pulse space-y-3">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-16 rounded-2xl bg-white shadow-sm" />)}
        </div>
      </div>
    )
  }

  if (!isPro && testCount >= FREE_LIMIT) {
    return <UpgradeScreen poolName={pool?.name ?? 'My Pool'} />
  }

  const showNudge = !isPro && testCount >= 3 && testCount < FREE_LIMIT

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
        <h1 className="text-white text-2xl font-bold" style={{fontFamily:"'Oswald',sans-serif",letterSpacing:'-.01em'}}>Log a Test</h1>
        <p className="text-white/55 text-sm mt-1">Enter your readings below</p>
      </div>

      {/* Wave */}
      <div className="bg-pool-deep">
        <svg viewBox="0 0 480 32" xmlns="http://www.w3.org/2000/svg" className="w-full block" style={{display:'block',marginBottom:-1}}>
          <path d="M0,28 C160,30 300,6 480,12 L480,32 L0,32 Z" fill="#F0F6FA"/>
        </svg>
      </div>

      {/* Form */}
      <div className="flex-1 px-4 pt-4 pb-10 bg-surface">
        {showNudge && <NudgeBanner count={testCount} />}
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}

        <div className="space-y-3 mb-6">
          {PARAMS.map((p, i) => {
            const val = values[p.key] ?? ''
            const num = parseFloat(val)
            const hasVal = val !== '' && !isNaN(num)
            return (
              <div key={p.key} className="bg-white rounded-2xl shadow-sm overflow-hidden flex items-stretch"
                style={{border: `2px solid ${hasVal ? '#0078B8' : '#C8DCE8'}`}}>
                {/* Label side */}
                <div className="flex items-center gap-3 flex-1 px-4 py-3.5">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold" style={{background: hasVal ? '#0078B8' : '#E8F2F8', color: hasVal ? 'white' : '#8AAABB'}}>
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-0.5">{p.label}</p>
                    <p className="text-[10px] text-text-faint">{p.range}</p>
                  </div>
                </div>
                {/* Input side — visually distinct tap target */}
                <div
                  className="flex items-center gap-1.5 px-4 shrink-0"
                  style={{
                    background: hasVal ? 'rgba(0,120,184,0.08)' : '#EEF5FA',
                    borderLeft: `2px solid ${hasVal ? '#0078B8' : '#C8DCE8'}`,
                    minWidth: 100,
                  }}
                >
                  <input
                    ref={el => { inputRefs.current[p.key] = el }}
                    type="text"
                    inputMode="decimal"
                    value={val}
                    onChange={e => set(p.key, e.target.value)}
                    onBlur={e => set(p.key, e.target.value)}
                    placeholder={p.placeholder}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    className="w-20 text-right text-lg font-bold outline-none bg-transparent text-text-primary placeholder:text-slate-400"
                    style={{fontFamily:"'DM Mono',monospace"}}
                  />
                  {p.unit && <span className="text-xs font-semibold shrink-0" style={{color: hasVal ? '#0078B8' : '#7A9DB0'}}>{p.unit}</span>}
                </div>
              </div>
            )
          })}
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full text-white font-bold py-4 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
          style={{background:'#0078B8'}}
        >
          {loading ? 'Calculating…' : 'Get My Recommendations →'}
        </button>
      </div>
    </div>
  )
}
