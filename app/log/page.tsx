'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import WaveDivider from '@/app/components/WaveDivider'
import ScanStrip from '@/app/components/ScanStrip'
import type { StripParamKey } from '@/lib/stripScan'

const PARAMS = [
  { key: 'ph',               label: 'pH',                  unit: '',    placeholder: '7.4', min: 0,    max: 14,   step: '0.1', range: '7.2 – 7.6',      hint: '',           saltOnly: false },
  { key: 'free_chlorine',    label: 'Free Chlorine',       unit: 'ppm', placeholder: '—',   min: 0,    max: 20,   step: '0.1', range: '1 – 3 ppm',       hint: '',           saltOnly: false },
  { key: 'total_alkalinity', label: 'Total Alkalinity',    unit: 'ppm', placeholder: '100', min: 0,    max: 500,  step: '1',   range: '80 – 120 ppm',    hint: '',           saltOnly: false },
  { key: 'cya',              label: 'Cyanuric Acid (CYA)', unit: 'ppm', placeholder: '40',  min: 0,    max: 300,  step: '1',   range: '30 – 50 ppm',     hint: 'Cyanuric acid (also called stabilizer or conditioner) protects chlorine from sunlight. Found on most liquid test kits and 5-in-1+ test strips. Skip if your kit doesn\'t test for it.', saltOnly: false },
  { key: 'calcium_hardness', label: 'Water Hardness',       unit: 'ppm', placeholder: '300', min: 0,    max: 1000, step: '1',   range: '200 – 400 ppm',   hint: 'Strips measure total hardness — enter that number here. Liquid test kits measure calcium hardness. Both work fine for PoolKeep.', saltOnly: false },
  { key: 'salt',             label: 'Salt',                unit: 'ppm', placeholder: '—',   min: 0,    max: 6000, step: '1',   range: '2700 – 3400 ppm', hint: 'Salt pools only. If you have a standard chlorine pool, leave this blank — it won\'t affect your score.', saltOnly: true },
]

const FREE_LIMIT = 5

// AquaChek 7 / HTH strip CYA color bands → stored as midpoint ppm
const CYA_STRIP_BANDS = [
  { label: '0',       midpoint: 0   },
  { label: '0–30',    midpoint: 15  },
  { label: '30–50',   midpoint: 40  },
  { label: '50–100',  midpoint: 75  },
  { label: '>100',    midpoint: 110 },
]

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
          <button onClick={() => router.push('/dashboard')} className="text-white text-base hover:opacity-75 transition-opacity" style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:300}}>
            Pool<span style={{fontWeight:800}}>Keep</span>
          </button>
        </div>
        <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-1">{poolName}</p>
        <h1 className="text-white text-2xl font-bold" style={{fontFamily:"'Oswald',sans-serif",letterSpacing:'-.01em'}}>Log a Test</h1>
      </div>

      {/* Wave */}
      <WaveDivider />

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
  const [pool, setPool] = useState<{ id: string; name: string; volume_gallons: number; type?: string } | null>(null)
  const [poolLoading, setPoolLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [testCount, setTestCount] = useState(0)
  const [isPro, setIsPro] = useState(false)
  const [isSaltPool, setIsSaltPool] = useState(false)
  const [poolTypeKnown, setPoolTypeKnown] = useState(false) // true when DB has explicit salt/chlorine type
  const [editId, setEditId] = useState<string | null>(null)
  const [showScan, setShowScan] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const editParam = new URLSearchParams(window.location.search).get('edit')
    setEditId(editParam)
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      const [{ data: profile }, { data: pools }] = await Promise.all([
        supabase.from('profiles').select('subscription_status').eq('id', data.user.id).maybeSingle(),
        supabase.from('pools').select('id,name,volume_gallons,type').order('created_at', { ascending: true }),
      ])
      const pro = profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing'
      setIsPro(pro)
      if (!pools || pools.length === 0) { router.push('/setup/pool'); return }
      const savedId = localStorage.getItem('poolkeep_active_pool')
      const active = (savedId && pools.find(p => p.id === savedId)) || pools[0]
      localStorage.setItem('poolkeep_active_pool', active.id)
      setPool(active)
      // Salt pool detection: DB type is authoritative when explicitly set.
      // Only fall back to localStorage toggle when pool type is unknown.
      const saltKey = `poolkeep_salt_pool_${active.id}`
      const dbIsSalt = active.type === 'saltwater' || active.type === 'salt'
      const dbIsChlorine = active.type === 'inground' || active.type === 'above_ground' || active.type === 'spa'
      const typeKnown = dbIsSalt || dbIsChlorine
      const localIsSalt = !typeKnown && localStorage.getItem(saltKey) === 'true'
      setPoolTypeKnown(typeKnown)
      setIsSaltPool(dbIsSalt || localIsSalt)
      if (!pro) {
        const { count } = await supabase
          .from('test_results')
          .select('id', { count: 'exact', head: true })
          .eq('pool_id', active.id)
        setTestCount(count ?? 0)
      }
      if (editParam) {
        const { data: existing } = await supabase
          .from('test_results')
          .select('ph,free_chlorine,total_alkalinity,cya,calcium_hardness,salt')
          .eq('id', editParam)
          .single()
        if (existing) {
          const toStr = (v: number | null, decimals: number) => v === null ? '' : v.toFixed(decimals)
          setValues({
            ph: toStr(existing.ph, 1),
            free_chlorine: toStr(existing.free_chlorine, 1),
            total_alkalinity: toStr(existing.total_alkalinity, 0),
            cya: toStr(existing.cya, 0),
            calcium_hardness: toStr(existing.calcium_hardness, 0),
            salt: toStr(existing.salt, 0),
          })
        }
      }
      setPoolLoading(false)
    })
  }, [router])

  function set(key: string, val: string) {
    setValues(v => ({ ...v, [key]: val }))
  }

  function handleScanConfirm(scanned: Partial<Record<StripParamKey, string>>) {
    setValues(v => {
      const next = { ...v }
      for (const [key, val] of Object.entries(scanned)) {
        if (val === undefined) continue
        next[key] = key === 'ph' ? formatPH(val) : val
      }
      return next
    })
    setShowScan(false)
  }

  // Smart pH formatter: lets users skip the decimal point
  // "7" → "7.0", "78" → "7.8", "74" → "7.4", "7.4" → "7.4"
  function formatPH(raw: string): string {
    const trimmed = raw.trim()
    if (trimmed === '') return trimmed
    // Already has a decimal — leave it alone
    if (trimmed.includes('.')) return trimmed
    const num = parseFloat(trimmed)
    if (isNaN(num)) return trimmed
    // Two-digit whole number where inserting a decimal makes a valid pH (e.g. 78 → 7.8)
    if (trimmed.length === 2 && num > 14) {
      const formatted = trimmed[0] + '.' + trimmed[1]
      const parsed = parseFloat(formatted)
      if (parsed >= 0 && parsed <= 14) return formatted
    }
    // Single digit or already valid — return as decimal
    return num.toFixed(1)
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
      method: editId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editId, testInput, poolId: pool.id, volumeGallons: pool.volume_gallons }),
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
        <WaveDivider />
        <div className="flex-1 px-4 pt-4 pb-10 animate-pulse space-y-3">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-16 rounded-2xl bg-white shadow-sm" />)}
        </div>
      </div>
    )
  }

  if (!isPro && testCount >= FREE_LIMIT && !editId) {
    return <UpgradeScreen poolName={pool?.name ?? 'My Pool'} />
  }

  const showNudge = !isPro && testCount >= 3 && testCount < FREE_LIMIT && !editId

  return (
    <div className="min-h-screen bg-surface flex flex-col" style={{maxWidth:480,margin:'0 auto'}}>

      {/* Header */}
      <div className="bg-pool-deep px-5 pt-5 pb-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/dashboard')} className="text-white/60 hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button onClick={() => router.push('/dashboard')} className="text-white text-base hover:opacity-75 transition-opacity" style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:300}}>
            Pool<span style={{fontWeight:800}}>Keep</span>
          </button>
        </div>
        <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-1">{pool?.name ?? 'My Pool'}</p>
        <h1 className="text-white text-2xl font-bold" style={{fontFamily:"'Oswald',sans-serif",letterSpacing:'-.01em'}}>{editId ? 'Edit Your Test' : 'Log a Test'}</h1>
        <p className="text-white/55 text-sm mt-1">{editId ? 'Fix a misread value below' : 'Enter your readings below'}</p>
      </div>

      {/* Wave */}
      <WaveDivider />

      {/* Form */}
      <div className="flex-1 px-4 pt-4 pb-10 bg-surface">
        {showNudge && <NudgeBanner count={testCount} />}

        <button
          onClick={() => setShowScan(true)}
          className="w-full flex items-center justify-center gap-2 font-bold py-3.5 rounded-xl text-sm mb-4 text-white"
          style={{ background: 'linear-gradient(90deg,#00E0B0 0%,#0078B8 100%)', boxShadow: '0 4px 16px rgba(0,120,184,0.3)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          Scan Test Strip
        </button>

        {showScan && <ScanStrip onConfirm={handleScanConfirm} onClose={() => setShowScan(false)} />}

        {/* First-timer tip — only shown before the first test is logged */}
        {testCount === 0 && !editId && (
          <div className="rounded-2xl px-4 py-3.5 mb-4 flex items-start gap-3" style={{background:'rgba(0,120,184,0.06)', border:'1.5px solid rgba(0,120,184,0.15)'}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2.2" strokeLinecap="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <div>
              <p className="text-xs font-bold mb-0.5" style={{color:'#0078B8'}}>Enter the numbers from your test kit or strips</p>
              <p className="text-[11px] leading-relaxed" style={{color:'#4A7A9A'}}>Only fill in what you tested — you can skip any field. More readings = more accurate score.</p>
            </div>
          </div>
        )}

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}

        {/* Salt pool toggle — only shown when pool type wasn't set during setup */}
        {!poolTypeKnown && (
          <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 mb-3 shadow-md" style={{border:'2px solid #A8C4D4'}}>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{color:'#1A3A4A'}}>Salt Pool?</p>
              <p className="text-[10px] text-text-muted">Shows salt field and adjusts recommendations</p>
            </div>
            <button
              onClick={() => {
                const next = !isSaltPool
                setIsSaltPool(next)
                if (pool) localStorage.setItem(`poolkeep_salt_pool_${pool.id}`, String(next))
              }}
              className="relative w-12 h-6 rounded-full transition-colors shrink-0"
              style={{background: isSaltPool ? '#0078B8' : '#A8C4D4'}}
            >
              <span className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all" style={{left: isSaltPool ? '26px' : '4px'}} />
            </button>
          </div>
        )}

        <div className="space-y-3 mb-6">
          {PARAMS.filter(p => p.key !== 'salt' || isSaltPool).map((p, i) => {
            const val = values[p.key] ?? ''
            const num = parseFloat(val)
            const hasVal = val !== '' && !isNaN(num)
            const isCya = p.key === 'cya'
            const cyaNum = isCya ? parseInt(val) : null
            const activeBand = isCya && cyaNum !== null && !isNaN(cyaNum)
              ? CYA_STRIP_BANDS.findIndex(b => b.midpoint === cyaNum)
              : -1
            return (
              <div key={p.key}>
                <div className="bg-white rounded-2xl overflow-hidden flex items-stretch"
                  style={{
                    border: `2px solid ${hasVal ? '#0078B8' : '#A8C4D4'}`,
                    boxShadow: hasVal ? '0 4px 16px rgba(0,120,184,0.18)' : '0 2px 8px rgba(0,60,100,0.10)',
                    borderRadius: isCya ? '16px 16px 0 0' : undefined,
                  }}>
                  {/* Label side */}
                  <div className="flex items-center gap-3 flex-1 px-4 py-3.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white" style={{background: hasVal ? '#0078B8' : '#4A7A9B'}}>
                      {i + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs font-bold uppercase tracking-widest" style={{color:'#1A3A4A'}}>{p.label}</p>
                        {p.saltOnly && <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full" style={{background:'rgba(0,120,184,0.08)',color:'#5A8AA0'}}>Salt pools only</span>}
                      </div>
                      <p className="text-[10px] font-medium" style={{color:'#5A7A8A'}}>{p.range}</p>
                      {p.hint && <p className="text-[10px] leading-snug mt-0.5" style={{color:'#4A7A9A'}}>{p.hint}</p>}
                    </div>
                  </div>
                  {/* Input side — visually distinct tap target */}
                  <div
                    className="flex items-center justify-end gap-1.5 py-3.5 px-4 shrink-0"
                    style={{
                      background: hasVal ? 'rgba(0,120,184,0.10)' : '#D8E8F0',
                      width: 110,
                      borderLeft: `2px solid ${hasVal ? 'rgba(0,120,184,0.3)' : '#A8C4D4'}`,
                    }}
                  >
                    <input
                      ref={el => { inputRefs.current[p.key] = el }}
                      type="text"
                      inputMode="decimal"
                      value={val}
                      onChange={e => set(p.key, e.target.value)}
                      onBlur={e => {
                        const formatted = p.key === 'ph' ? formatPH(e.target.value) : e.target.value
                        set(p.key, formatted)
                      }}
                      placeholder={p.placeholder}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      className="w-16 text-right text-2xl font-bold outline-none bg-transparent placeholder:text-slate-400"
                      style={{fontFamily:"'DM Mono',monospace", color: hasVal ? '#0078B8' : '#7A9DB0'}}
                    />
                    {p.unit && <span className="text-xs font-bold shrink-0 mt-1" style={{color: hasVal ? '#0078B8' : '#7A9DB0'}}>{p.unit}</span>}
                  </div>
                </div>

                {/* CYA strip band helper — seamlessly attached below the CYA card */}
                {isCya && (
                  <div className="bg-white px-4 pt-2.5 pb-3.5"
                    style={{
                      border: `2px solid ${hasVal ? '#0078B8' : '#A8C4D4'}`,
                      borderTop: 'none',
                      borderRadius: '0 0 16px 16px',
                    }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{color:'#5A7A8A'}}>Using test strips? Pick your color band:</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {CYA_STRIP_BANDS.map((band, bi) => {
                        const isActive = bi === activeBand
                        return (
                          <button
                            key={bi}
                            type="button"
                            onClick={() => set('cya', String(band.midpoint))}
                            className="text-xs font-bold px-3 py-1.5 rounded-full transition-all"
                            style={{
                              background: isActive ? '#0078B8' : 'rgba(0,120,184,0.08)',
                              color: isActive ? '#fff' : '#4A7A9A',
                              border: `1.5px solid ${isActive ? '#0078B8' : 'rgba(0,120,184,0.20)'}`,
                            }}
                          >
                            {band.label}
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-[9px] mt-1.5" style={{color:'#8AAABB'}}>Tap a band to fill — we use the midpoint for calculations</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full text-white font-bold py-4 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 text-base"
          style={{background:'#0078B8', boxShadow:'0 6px 20px rgba(0,120,184,0.4)'}}
        >
          {loading ? 'Calculating…' : editId ? 'Save Changes →' : 'Get My Recommendations →'}
        </button>
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full text-sm font-medium py-3 text-text-muted hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
