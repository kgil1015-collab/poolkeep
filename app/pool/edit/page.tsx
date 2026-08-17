'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import WaveDivider from '@/app/components/WaveDivider'

const SANITIZERS = [
  { id: 'chlorine', label: 'Chlorine',    sub: 'You add chlorine manually — tablets, liquid, or shock' },
  { id: 'salt',     label: 'Salt Water',  sub: 'You have a salt chlorine generator (SWG)' },
]

const STRUCTURES = [
  { id: 'inground',     label: 'In-Ground',     sub: 'Standard in-ground pool' },
  { id: 'above_ground', label: 'Above-Ground',  sub: 'Above-ground or semi-inground' },
  { id: 'spa',          label: 'Spa / Hot Tub', sub: 'Spa, hot tub, or plunge pool' },
]

const SIZES = [
  { label: 'Small',       sub: '~10,000 gal', value: 10000 },
  { label: 'Medium',      sub: '~15,000 gal', value: 15000 },
  { label: 'Large',       sub: '~20,000 gal', value: 20000 },
  { label: 'Extra Large', sub: '~30,000 gal', value: 30000 },
]

const STRIP_BRANDS = [
  { id: 'aquachek_7way', label: 'AquaChek 7-Way',  sub: 'Verified pad layout — our most accurate camera scan' },
  { id: 'taylor',        label: 'Taylor 7-Way',     sub: 'Verified pad layout — high scan accuracy' },
  { id: 'other',         label: 'Other / Not Sure', sub: 'Camera scan is less reliable for unverified brands — manual entry is recommended instead' },
]

export default function EditPoolPage() {
  const router = useRouter()
  const [poolId, setPoolId]             = useState<string | null>(null)
  const [poolName, setPoolName]         = useState('')
  const [sanitizer, setSanitizer]       = useState('')  // 'salt' | 'chlorine'
  const [structure, setStructure]       = useState('')  // 'inground' | 'above_ground' | 'spa'
  const [volumeGallons, setVolumeGallons] = useState<number | null>(null)
  const [customVolume, setCustomVolume] = useState('')
  const [stripBrand, setStripBrand]     = useState('')  // 'aquachek_7way' | 'other' | '' (unset)
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      const savedId = typeof window !== 'undefined' ? localStorage.getItem('poolkeep_active_pool') : null
      if (!savedId) { router.push('/dashboard'); return }

      const { data: pool } = await supabase
        .from('pools')
        .select('id,name,type,volume_gallons,strip_brand')
        .eq('id', savedId)
        .single()

      if (!pool) { router.push('/dashboard'); return }
      setPoolId(pool.id)
      setPoolName(pool.name ?? '')
      setStripBrand(pool.strip_brand ?? '')

      // Decode stored type back into sanitizer + structure
      const storedType: string = pool.type ?? ''
      if (storedType === 'saltwater' || storedType === 'salt') {
        setSanitizer('salt')
        setStructure('')   // structure not stored for salt pools — require user to confirm
      } else if (storedType === 'inground' || storedType === 'above_ground' || storedType === 'spa') {
        setSanitizer('chlorine')
        setStructure(storedType)
      } else {
        setSanitizer('')
        setStructure('')
      }

      const matchedSize = SIZES.find(s => s.value === pool.volume_gallons)
      if (matchedSize) {
        setVolumeGallons(pool.volume_gallons)
      } else {
        setCustomVolume(String(pool.volume_gallons ?? ''))
      }
      setLoading(false)
    })
  }, [router])

  async function handleSave() {
    setError('')
    const volume = volumeGallons ?? parseInt(customVolume)
    if (!poolName.trim()) { setError('Please enter a pool name.'); return }
    if (!sanitizer) { setError('Please select a sanitizer type.'); return }
    if (sanitizer !== 'salt' && !structure) { setError('Please select a pool shape.'); return }
    if (!volume || volume < 500) { setError('Please select or enter a valid pool size.'); return }

    // Re-encode to stored type
    const poolType = sanitizer === 'salt' ? 'saltwater' : structure

    setSaving(true)
    const supabase = createClient()
    const { error: dbError } = await supabase
      .from('pools')
      .update({ name: poolName.trim(), type: poolType, volume_gallons: volume, strip_brand: stripBrand || null })
      .eq('id', poolId!)

    setSaving(false)
    if (dbError) { setError(dbError.message); return }
    router.push('/dashboard')
  }

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col" style={{maxWidth:480,margin:'0 auto'}}>
        <div className="bg-pool-deep px-5 pt-5 pb-6 animate-pulse">
          <div className="h-5 w-24 rounded-full bg-white/15 mb-6" />
          <div className="h-7 w-36 rounded-full bg-white/20" />
        </div>
        <WaveDivider />
        <div className="flex-1 px-4 pt-4 animate-pulse space-y-3">
          <div className="h-16 rounded-2xl bg-white shadow-sm" />
          <div className="h-16 rounded-2xl bg-white shadow-sm" />
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4].map(i => <div key={i} className="h-16 rounded-2xl bg-white shadow-sm" />)}
          </div>
        </div>
      </div>
    )
  }

  /* ── Edit form ── */
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
        <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-1">Settings</p>
        <h1 className="text-white text-2xl font-bold" style={{fontFamily:"'Oswald',sans-serif",letterSpacing:'-.01em'}}>Edit Pool</h1>
        <p className="text-white/55 text-sm mt-1">Update your pool details</p>
      </div>

      {/* Wave */}
      <WaveDivider />

      {/* Form */}
      <div className="flex-1 px-4 pt-4 pb-10 bg-surface space-y-5">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

        {/* Name */}
        <div className="bg-white rounded-2xl px-4 py-4 shadow-sm border border-gray-100">
          <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{color:'#1A3A4A'}}>Pool Name</label>
          <input
            type="text"
            value={poolName}
            onChange={e => setPoolName(e.target.value)}
            placeholder="Backyard Pool"
            className="w-full text-base outline-none text-text-primary bg-transparent border-b border-gray-100 pb-2 focus:border-pool-dark transition-colors"
          />
        </div>

        {/* Sanitizer */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-2 px-1" style={{color:'#1A3A4A'}}>Sanitizer Type</p>
          <div className="space-y-2">
            {SANITIZERS.map(s => {
              const active = sanitizer === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => setSanitizer(s.id)}
                  className="w-full bg-white rounded-2xl p-3.5 flex items-center justify-between text-left border-2 transition-all shadow-sm"
                  style={{borderColor: active ? '#0078B8' : '#E8F0F6'}}
                >
                  <div>
                    <p className="font-semibold text-text-primary text-sm">{s.label}</p>
                    <p className="text-text-muted text-xs mt-0.5">{s.sub}</p>
                  </div>
                  <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ml-3 transition-all"
                    style={{borderColor: active ? '#0078B8' : '#D1D9DD', background: active ? '#0078B8' : 'transparent'}}>
                    {active && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Structure */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-2 px-1" style={{color:'#1A3A4A'}}>Pool Shape</p>
          <div className="space-y-2">
            {STRUCTURES.map(t => {
              const active = structure === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setStructure(t.id)}
                  className="w-full bg-white rounded-2xl p-3.5 flex items-center justify-between text-left border-2 transition-all shadow-sm"
                  style={{borderColor: active ? '#0078B8' : '#E8F0F6'}}
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
          </div>
        </div>

        {/* Size */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-2 px-1" style={{color:'#1A3A4A'}}>Pool Size</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {SIZES.map(s => {
              const active = volumeGallons === s.value
              return (
                <button
                  key={s.value}
                  onClick={() => { setVolumeGallons(s.value); setCustomVolume('') }}
                  className="bg-white rounded-2xl p-4 text-left border-2 transition-all shadow-sm"
                  style={{borderColor: active ? '#0078B8' : '#E8F0F6'}}
                >
                  <p className="font-bold text-text-primary text-sm">{s.label}</p>
                  <p className="text-text-muted text-xs mt-0.5">{s.sub}</p>
                </button>
              )
            })}
          </div>
          <div className="bg-white rounded-2xl px-4 py-4 shadow-sm border-2 transition-all"
            style={{borderColor: customVolume ? '#0078B8' : '#E8F0F6'}}>
            <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{color:'#1A3A4A'}}>Custom Gallons</label>
            <input
              type="number"
              value={customVolume}
              onChange={e => { setCustomVolume(e.target.value); setVolumeGallons(null) }}
              placeholder="e.g. 18,500"
              className="w-full text-base outline-none text-text-primary bg-transparent"
            />
          </div>
        </div>

        {/* Test strip brand */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-2 px-1" style={{color:'#1A3A4A'}}>Test Strip Brand</p>
          <div className="space-y-2">
            {STRIP_BRANDS.map(b => {
              const active = stripBrand === b.id
              return (
                <button
                  key={b.id}
                  onClick={() => setStripBrand(b.id)}
                  className="w-full bg-white rounded-2xl p-3.5 flex items-center justify-between text-left border-2 transition-all shadow-sm"
                  style={{borderColor: active ? '#0078B8' : '#E8F0F6'}}
                >
                  <div>
                    <p className="font-semibold text-text-primary text-sm">{b.label}</p>
                    <p className="text-text-muted text-xs mt-0.5">{b.sub}</p>
                  </div>
                  <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ml-3 transition-all"
                    style={{borderColor: active ? '#0078B8' : '#D1D9DD', background: active ? '#0078B8' : 'transparent'}}>
                    {active && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-text-faint px-1 pt-2 leading-relaxed">
            Only affects the camera scan feature — never your dosing calculations.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full text-white font-bold py-4 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 text-base"
          style={{background:'#0078B8', boxShadow:'0 6px 20px rgba(0,120,184,0.35)'}}
        >
          {saving ? 'Saving…' : 'Save Changes →'}
        </button>
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full text-sm font-medium py-2 text-text-muted hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
