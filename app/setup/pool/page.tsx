'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const POOL_TYPES = [
  { id: 'inground', label: 'In-Ground', sub: 'Standard in-ground pool' },
  { id: 'above_ground', label: 'Above-Ground', sub: 'Above-ground or semi-inground' },
  { id: 'spa', label: 'Spa / Hot Tub', sub: 'Spa, hot tub, or plunge pool' },
]

const SIZES = [
  { label: 'Small', sub: '~10,000 gal', value: 10000 },
  { label: 'Medium', sub: '~15,000 gal', value: 15000 },
  { label: 'Large', sub: '~20,000 gal', value: 20000 },
  { label: 'Extra Large', sub: '~30,000 gal', value: 30000 },
]

export default function PoolSetupPage() {
  const router = useRouter()
  const [gateBlocked, setGateBlocked] = useState<boolean | null>(null)
  const [step, setStep] = useState(1)
  const [poolName, setPoolName] = useState('')
  const [poolType, setPoolType] = useState('')
  const [volumeGallons, setVolumeGallons] = useState<number | null>(null)
  const [customVolume, setCustomVolume] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      const [{ data: profile }, { count }] = await Promise.all([
        supabase.from('profiles').select('subscription_status').eq('id', data.user.id).single(),
        supabase.from('pools').select('id', { count: 'exact', head: true }).eq('user_id', data.user.id),
      ])
      const pro = profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing'
      setGateBlocked(!pro && (count ?? 0) >= 1)
    })
  }, [router])

  async function handleSave() {
    setError('')
    const volume = volumeGallons ?? parseInt(customVolume)
    if (!poolType || !volume || volume < 500) { setError('Please complete all fields.'); return }
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { error: dbError } = await supabase.from('pools').insert({
      user_id: user.id,
      name: poolName || 'My Pool',
      type: poolType,
      volume_gallons: volume,
      zip_code: zipCode || null,
    })

    setLoading(false)
    if (dbError) { setError(dbError.message); return }
    router.push('/dashboard')
  }

  if (gateBlocked === null) {
    return (
      <div className="min-h-screen bg-surface flex flex-col" style={{maxWidth:480,margin:'0 auto'}}>
        <div className="bg-pool-deep px-5 pt-5 pb-8 animate-pulse">
          <div className="h-4 w-20 rounded-full bg-white/15 mb-6" />
          <div className="h-3 w-24 rounded-full bg-white/15 mb-2" />
          <div className="h-7 w-40 rounded-full bg-white/20" />
        </div>
        <div className="bg-pool-deep"><svg viewBox="0 0 480 32" className="w-full block"><path d="M0,28 C160,30 300,6 480,12 L480,32 L0,32 Z" fill="#F0F6FA"/></svg></div>
        <div className="flex-1 px-4 pt-6 animate-pulse space-y-4">
          <div className="h-14 rounded-2xl bg-white shadow-sm" />
          <div className="grid grid-cols-3 gap-2">
            {[1,2,3].map(i => <div key={i} className="h-16 rounded-2xl bg-white shadow-sm" />)}
          </div>
          <div className="h-14 rounded-2xl bg-white shadow-sm" />
          <div className="h-12 rounded-2xl bg-white shadow-sm" />
          <div className="h-12 rounded-xl bg-white shadow-sm mt-4" />
        </div>
      </div>
    )
  }

  if (gateBlocked) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6" style={{maxWidth:480,margin:'0 auto'}}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{background:'rgba(0,120,184,0.1)'}}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <h2 className="text-xl font-bold text-text-primary text-center mb-2" style={{fontFamily:"'Oswald',sans-serif"}}>Pro Feature</h2>
        <p className="text-text-muted text-sm text-center mb-6 leading-relaxed">
          Free accounts are limited to 1 pool. Upgrade to Pro to manage up to 5 pools.
        </p>
        <button
          onClick={() => router.push('/pro')}
          className="w-full font-bold py-4 rounded-xl text-sm mb-3"
          style={{background:'#0078B8',color:'white'}}
        >
          Upgrade to Pro →
        </button>
        <button
          onClick={() => router.back()}
          className="text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          Go back
        </button>
      </div>
    )
  }

  const titles = ['Pool Type', 'Pool Size', 'Final Details']
  const subtitles = ['What kind of pool do you have?', 'Roughly how many gallons?', 'Give your pool a name']

  return (
    <div className="min-h-screen bg-surface flex flex-col" style={{maxWidth:480,margin:'0 auto'}}>

      {/* Header */}
      <div className="bg-pool-deep px-5 pt-5 pb-6">
        <div className="flex items-center justify-between mb-6">
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
            <span className="text-white text-base" style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:300}}>
              Pool<span style={{fontWeight:800}}>Keep</span>
            </span>
          </div>
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)} className="text-white/50 text-xs hover:text-white/80 transition-colors">
              ← Back
            </button>
          )}
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5 mb-5">
          {[1,2,3].map(n => (
            <div key={n} className="h-1 flex-1 rounded-full transition-all duration-300" style={{background: n <= step ? '#00E0B0' : 'rgba(255,255,255,0.2)'}} />
          ))}
        </div>

        <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-1">Step {step} of 3</p>
        <h1 className="text-white text-2xl font-bold" style={{fontFamily:"'Oswald',sans-serif",letterSpacing:'-.01em'}}>{titles[step-1]}</h1>
        <p className="text-white/55 text-sm mt-1">{subtitles[step-1]}</p>
      </div>

      {/* Wave */}
      <div className="bg-pool-deep">
        <svg viewBox="0 0 480 32" xmlns="http://www.w3.org/2000/svg" className="w-full block" style={{display:'block',marginBottom:-1}}>
          <path d="M0,28 C160,30 300,6 480,12 L480,32 L0,32 Z" fill="#F0F6FA"/>
        </svg>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pt-4 pb-10 bg-surface">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}

        {/* Step 1: Pool type */}
        {step === 1 && (
          <div className="space-y-3">
            {POOL_TYPES.map(t => {
              const active = poolType === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setPoolType(t.id)}
                  className="w-full bg-white rounded-2xl p-4 flex items-center justify-between text-left transition-all border-2 shadow-sm"
                  style={{borderColor: active ? '#0078B8' : 'transparent'}}
                >
                  <div>
                    <p className="font-semibold text-text-primary text-sm">{t.label}</p>
                    <p className="text-text-muted text-xs mt-0.5">{t.sub}</p>
                  </div>
                  <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ml-3 transition-all"
                    style={{borderColor: active ? '#0078B8' : '#D1D9DD', background: active ? '#0078B8' : 'transparent'}}>
                    {active && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                </button>
              )
            })}
            <button
              disabled={!poolType}
              onClick={() => setStep(2)}
              className="w-full bg-pool-dark text-white font-bold py-3.5 rounded-xl mt-2 hover:opacity-90 transition-opacity disabled:opacity-40 text-sm"
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step 2: Pool size */}
        {step === 2 && (
          <div>
            <p className="text-xs text-text-muted mb-3 px-1">Not sure? Most standard backyard pools are <strong className="text-text-primary">Medium (~15,000 gal)</strong>. Above-ground pools are usually Small.</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {SIZES.map(s => {
                const active = volumeGallons === s.value
                return (
                  <button
                    key={s.value}
                    onClick={() => { setVolumeGallons(s.value); setCustomVolume('') }}
                    className="bg-white rounded-2xl p-4 text-left border-2 transition-all shadow-sm"
                    style={{borderColor: active ? '#0078B8' : 'transparent'}}
                  >
                    <p className="font-bold text-text-primary text-sm">{s.label}</p>
                    <p className="text-text-muted text-xs mt-0.5">{s.sub}</p>
                  </button>
                )
              })}
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-5 border-2 transition-all" style={{borderColor: customVolume ? '#0078B8' : 'transparent'}}>
              <label className="text-xs font-semibold uppercase tracking-widest text-text-muted block mb-2">Custom Gallons</label>
              <input
                type="number"
                value={customVolume}
                onChange={e => { setCustomVolume(e.target.value); setVolumeGallons(null) }}
                placeholder="e.g. 18,500"
                className="w-full text-sm outline-none text-text-primary bg-transparent"
              />
            </div>
            <button
              disabled={!volumeGallons && !customVolume}
              onClick={() => setStep(3)}
              className="w-full bg-pool-dark text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 text-sm"
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step 3: Name + zip */}
        {step === 3 && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <label className="text-xs font-semibold uppercase tracking-widest text-text-muted block mb-2">Pool Nickname</label>
              <input
                type="text"
                value={poolName}
                onChange={e => setPoolName(e.target.value)}
                placeholder="Backyard Pool"
                className="w-full text-sm outline-none text-text-primary bg-transparent border-b border-gray-100 pb-1 focus:border-pool-dark transition-colors"
              />
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <label className="text-xs font-semibold uppercase tracking-widest text-text-muted block mb-2">
                Zip Code <span className="normal-case font-normal text-text-faint">— optional</span>
              </label>
              <input
                type="text"
                value={zipCode}
                onChange={e => setZipCode(e.target.value)}
                placeholder="e.g. 85001"
                maxLength={5}
                className="w-full text-sm outline-none text-text-primary bg-transparent border-b border-gray-100 pb-1 focus:border-pool-dark transition-colors"
              />
            </div>
            <button
              disabled={loading}
              onClick={handleSave}
              className="w-full text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60 text-sm mt-1"
              style={{background:'#00E0B0',color:'#003D5C'}}
            >
              {loading ? 'Saving…' : 'Save My Pool →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
