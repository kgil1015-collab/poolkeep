'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { calculateRecommendations } from '@/lib/recommendations'

const PARAMS = [
  { key: 'ph',               label: 'pH',                  unit: '',    placeholder: '7.4', min: 0,    max: 14,   step: '0.1', range: '7.2 – 7.6' },
  { key: 'free_chlorine',    label: 'Free Chlorine',       unit: 'ppm', placeholder: '2.0', min: 0,    max: 20,   step: '0.1', range: '1 – 3 ppm' },
  { key: 'total_alkalinity', label: 'Total Alkalinity',    unit: 'ppm', placeholder: '100', min: 0,    max: 500,  step: '1',   range: '80 – 120 ppm' },
  { key: 'cya',              label: 'Cyanuric Acid (CYA)', unit: 'ppm', placeholder: '40',  min: 0,    max: 300,  step: '1',   range: '30 – 50 ppm' },
  { key: 'calcium_hardness', label: 'Calcium Hardness',    unit: 'ppm', placeholder: '300', min: 0,    max: 1000, step: '1',   range: '200 – 400 ppm' },
  { key: 'salt',             label: 'Salt',                unit: 'ppm', placeholder: '—',   min: 0,    max: 6000, step: '1',   range: '2700 – 3400 ppm (salt pools)' },
]

export default function LogTestPage() {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>({})
  const [pool, setPool] = useState<{ id: string; name: string; volume_gallons: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      const { data: pools } = await supabase.from('pools').select('id,name,volume_gallons').limit(1).single()
      if (!pools) { router.push('/setup/pool'); return }
      setPool(pools)
    })
  }, [router])

  function set(key: string, val: string) {
    setValues(v => ({ ...v, [key]: val }))
  }

  async function handleSubmit() {
    setError('')
    const ph = parseFloat(values.ph)
    const free_chlorine = parseFloat(values.free_chlorine)
    const total_alkalinity = parseInt(values.total_alkalinity)
    const cya = parseInt(values.cya)
    const calcium_hardness = parseInt(values.calcium_hardness)

    if (isNaN(ph) || isNaN(free_chlorine) || isNaN(total_alkalinity) || isNaN(cya) || isNaN(calcium_hardness)) {
      setError('Please enter the first 5 readings. Salt is optional.')
      return
    }

    if (!pool) return
    setLoading(true)

    const testInput = { ph, free_chlorine, total_alkalinity, cya, calcium_hardness, salt: values.salt ? parseInt(values.salt) : null }
    const result = calculateRecommendations(testInput, pool.volume_gallons)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { error: dbError } = await supabase.from('test_results').insert({
      pool_id: pool.id,
      user_id: user.id,
      ...testInput,
      health_score: result.health_score,
      recommendations: result,
    })

    setLoading(false)
    if (dbError) { setError(dbError.message); return }
    router.push('/dashboard')
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
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}

        <div className="space-y-3 mb-6">
          {PARAMS.map((p, i) => {
            const val = values[p.key] ?? ''
            const num = parseFloat(val)
            const hasVal = val !== '' && !isNaN(num)
            return (
              <div key={p.key} className="bg-white rounded-2xl px-4 py-3.5 shadow-sm flex items-center gap-4">
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold" style={{background: hasVal ? '#0078B8' : '#E8F2F8', color: hasVal ? 'white' : '#8AAABB'}}>
                  {i + 1}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-0.5">{p.label}</p>
                  <p className="text-[10px] text-text-faint">{p.range}</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={val}
                    onChange={e => set(p.key, e.target.value)}
                    placeholder={p.placeholder}
                    min={p.min}
                    max={p.max}
                    step={p.step}
                    className="w-16 text-right text-base font-bold outline-none bg-transparent text-text-primary placeholder:text-gray-300"
                    style={{fontFamily:"'DM Mono',monospace"}}
                  />
                  {p.unit && <span className="text-xs text-text-muted">{p.unit}</span>}
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
