'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const POOL_TYPES = [
  { id: 'inground', label: 'In-Ground', icon: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="8" width="20" height="12" rx="2"/>
      <path d="M6 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/>
      <path d="M6 14 Q9 11 12 14 Q15 17 18 14" strokeWidth="1.4"/>
    </svg>
  )},
  { id: 'above_ground', label: 'Above-Ground', icon: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="10" rx="9" ry="4"/>
      <path d="M3 10v6a9 4 0 0 0 18 0v-6"/>
      <path d="M7 13 Q10 11 12 13 Q14 15 17 13" strokeWidth="1.4"/>
    </svg>
  )},
  { id: 'spa', label: 'Spa / Hot Tub', icon: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12 Q6 8 8 12 Q10 16 12 12 Q14 8 16 12"/>
      <rect x="2" y="14" width="20" height="6" rx="2"/>
      <path d="M7 14v-2M12 14v-3M17 14v-2"/>
    </svg>
  )},
]

const SIZES = [
  { label: 'Small', sub: '~10,000 gal', value: 10000 },
  { label: 'Medium', sub: '~15,000 gal', value: 15000 },
  { label: 'Large', sub: '~20,000 gal', value: 20000 },
  { label: 'Extra Large', sub: '~30,000 gal', value: 30000 },
]

export default function PoolSetupPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [poolName, setPoolName] = useState('My Pool')
  const [poolType, setPoolType] = useState('')
  const [volumeGallons, setVolumeGallons] = useState<number | null>(null)
  const [customVolume, setCustomVolume] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  return (
    <div className="min-h-screen bg-surface flex flex-col" style={{maxWidth:480,margin:'0 auto'}}>
      {/* Header */}
      <div className="bg-pool-deep px-5 pt-5 pb-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => step > 1 ? setStep(s => s - 1) : router.push('/dashboard')} className="text-white/60 hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div className="flex gap-1.5 flex-1">
            {[1,2,3].map(n => (
              <div key={n} className="h-1 flex-1 rounded-full transition-all" style={{background: n <= step ? '#00E0B0' : 'rgba(255,255,255,0.2)'}} />
            ))}
          </div>
          <span className="text-white/40 text-xs">{step} of 3</span>
        </div>
        <h1 className="text-white text-2xl font-bold" style={{fontFamily:"'Oswald',sans-serif"}}>
          {step === 1 ? 'Pool Type' : step === 2 ? 'Pool Size' : 'Last Details'}
        </h1>
        <p className="text-white/55 text-sm mt-1">
          {step === 1 ? 'What kind of pool do you have?' : step === 2 ? 'How many gallons does it hold?' : 'Almost done!'}
        </p>
      </div>

      <div className="flex-1 px-4 pt-6 pb-10">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}

        {/* Step 1: Pool type */}
        {step === 1 && (
          <div className="space-y-3">
            {POOL_TYPES.map(t => (
              <button
                key={t.id}
                onClick={() => setPoolType(t.id)}
                className="w-full bg-white rounded-2xl p-4 flex items-center gap-4 text-left transition-all border-2"
                style={{borderColor: poolType === t.id ? '#0078B8' : 'transparent', boxShadow: poolType === t.id ? '0 0 0 0' : '0 1px 3px rgba(0,0,0,0.07)'}}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{background: poolType === t.id ? 'rgba(0,120,184,0.1)' : '#F0F6FA', color: poolType === t.id ? '#0078B8' : '#4A6A7C'}}>
                  {t.icon}
                </div>
                <div>
                  <p className="font-semibold text-text-primary">{t.label}</p>
                </div>
                {poolType === t.id && (
                  <div className="ml-auto w-5 h-5 rounded-full bg-pool-dark flex items-center justify-center">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                )}
              </button>
            ))}
            <button
              disabled={!poolType}
              onClick={() => setStep(2)}
              className="w-full bg-pool-dark text-white font-bold py-3.5 rounded-xl mt-4 hover:opacity-90 transition-opacity disabled:opacity-40 text-sm"
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step 2: Pool size */}
        {step === 2 && (
          <div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {SIZES.map(s => (
                <button
                  key={s.value}
                  onClick={() => { setVolumeGallons(s.value); setCustomVolume('') }}
                  className="bg-white rounded-2xl p-4 text-left border-2 transition-all"
                  style={{borderColor: volumeGallons === s.value ? '#0078B8' : 'transparent', boxShadow: volumeGallons === s.value ? 'none' : '0 1px 3px rgba(0,0,0,0.07)'}}
                >
                  <p className="font-bold text-text-primary">{s.label}</p>
                  <p className="text-text-muted text-xs mt-0.5">{s.sub}</p>
                </button>
              ))}
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-5">
              <label className="text-xs font-semibold uppercase tracking-widest text-text-muted block mb-2">Custom Gallons</label>
              <input
                type="number"
                value={customVolume}
                onChange={e => { setCustomVolume(e.target.value); setVolumeGallons(null) }}
                placeholder="e.g. 18500"
                className="w-full text-sm outline-none text-text-primary bg-transparent border-b border-gray-200 pb-1 focus:border-pool-dark transition-colors"
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
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <label className="text-xs font-semibold uppercase tracking-widest text-text-muted block mb-2">Pool Name</label>
              <input
                type="text"
                value={poolName}
                onChange={e => setPoolName(e.target.value)}
                placeholder="My Pool"
                className="w-full text-sm outline-none text-text-primary bg-transparent border-b border-gray-200 pb-1 focus:border-pool-dark transition-colors"
              />
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <label className="text-xs font-semibold uppercase tracking-widest text-text-muted block mb-2">Zip Code <span className="normal-case font-normal text-text-muted">(for weather)</span></label>
              <input
                type="text"
                value={zipCode}
                onChange={e => setZipCode(e.target.value)}
                placeholder="e.g. 85001"
                maxLength={5}
                className="w-full text-sm outline-none text-text-primary bg-transparent border-b border-gray-200 pb-1 focus:border-pool-dark transition-colors"
              />
            </div>
            <button
              disabled={loading}
              onClick={handleSave}
              className="w-full bg-pool-dark text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60 text-sm mt-2"
            >
              {loading ? 'Saving…' : 'Save My Pool →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
