'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const FREE_FEATURES = [
  '1 pool',
  'Water test logging',
  'Treatment recommendations',
  'Last 10 tests in history',
  'Email, text & print sharing',
]

const PRO_FEATURES = [
  { text: 'Up to 5 pools', highlight: false },
  { text: 'Unlimited test history', highlight: false },
  { text: 'Full treatment plans with dosing', highlight: false },
  { text: 'Share reports with other PoolKeep users', highlight: false },
  { text: 'Priority support', highlight: false },
  { text: 'Early access to new features', highlight: false },
]

const SERVICE_FEATURES = [
  'Unlimited client pools',
  'Client-facing report portal',
  'Branded PDF reports',
  'Schedule & visit tracking',
  'Team member access',
  'Everything in Pro',
]

const PRICE_MONTHLY = process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY ?? ''
const PRICE_ANNUAL = process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL ?? ''
const PRICE_FOUNDING = process.env.NEXT_PUBLIC_STRIPE_PRICE_FOUNDING ?? ''

const FOUNDING_SPOTS_SHOWN = 200

export default function ProPage() {
  const router = useRouter()
  const [billing, setBilling] = useState<'monthly' | 'annual' | 'founding'>('founding')
  const [loading, setLoading] = useState(false)
  const [upgradeError, setUpgradeError] = useState<string | null>(null)
  const [notified, setNotified] = useState(false)
  const [notifyLoading, setNotifyLoading] = useState(false)
  const [subStatus, setSubStatus] = useState<string | null>(null)
  const [subPlan, setSubPlan] = useState<string | null>(null)
  const [periodEnd, setPeriodEnd] = useState<string | null>(null)

  useEffect(() => {
    if (localStorage.getItem('poolkeep_service_notify')) setNotified(true)
  }, [])

  async function handleNotify() {
    setNotifyLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('profiles').update({
          service_waitlist: true,
          service_waitlist_at: new Date().toISOString(),
        }).eq('id', user.id)
      }
    } finally {
      setNotified(true)
      setNotifyLoading(false)
      localStorage.setItem('poolkeep_service_notify', '1')
    }
  }

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_status,plan,current_period_end')
        .eq('id', data.user.id)
        .single()
      if (profile) {
        setSubStatus(profile.subscription_status ?? null)
        setSubPlan(profile.plan ?? null)
        setPeriodEnd(profile.current_period_end ?? null)
      }
    })
  }, [])

  const isPro = subStatus === 'active' || subStatus === 'trialing'

  async function handleUpgrade() {
    const priceId = billing === 'annual' ? PRICE_ANNUAL : billing === 'founding' ? PRICE_FOUNDING : PRICE_MONTHLY
    if (!priceId) {
      setUpgradeError('Stripe price not configured — check environment variables.')
      return
    }
    setLoading(true)
    setUpgradeError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, founding: billing === 'founding' }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`)
      window.location.href = data.url
    } catch (err) {
      setUpgradeError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col" style={{maxWidth:480,margin:'0 auto'}}>

      {/* Header */}
      <div className="bg-pool-deep px-5 pt-5 pb-6 relative overflow-hidden">
        {/* Radial glow */}
        <div className="absolute top-0 right-0 w-48 h-48 pointer-events-none" style={{background:'radial-gradient(circle at 80% 20%, rgba(0,224,176,0.13) 0%, transparent 70%)'}} />
        <div className="flex items-center gap-3 mb-6 relative">
          <button onClick={() => router.push('/dashboard')} className="text-white/60 hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span className="text-white text-base" style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:300}}>
            Pool<span style={{fontWeight:800}}>Keep</span>
          </span>
        </div>
        <div className="relative">
          <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-1">Upgrade</p>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-white text-2xl font-bold" style={{fontFamily:"'Oswald',sans-serif",letterSpacing:'-.01em'}}>PoolKeep Pro</h1>
            {/* Crown */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{opacity:0.7}}>
              <path d="M3 18h18M5 18l2-8 5 4 4-7 4 7-5-4 2 8" stroke="#00E0B0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="text-white/55 text-sm">Everything you need to keep your pool perfect</p>
        </div>
      </div>

      {/* Wave */}
      <div className="bg-pool-deep">
        <svg viewBox="0 0 480 32" xmlns="http://www.w3.org/2000/svg" className="w-full block" style={{display:'block',marginBottom:-1}}>
          <path d="M0,28 C160,30 300,6 480,12 L480,32 L0,32 Z" fill="#F0F6FA"/>
        </svg>
      </div>

      <div className="flex-1 px-4 pt-4 pb-28 bg-surface space-y-4">

        {isPro ? (
          <>
            {/* Hero membership card */}
            <div className="rounded-2xl overflow-hidden" style={{background:'linear-gradient(145deg, #002D44 0%, #004D6B 45%, #006B5A 100%)', boxShadow:'0 12px 40px rgba(0,45,68,0.35)'}}>
              <div className="px-6 pt-6 pb-6 relative overflow-hidden">
                {/* Glow accents */}
                <div className="absolute top-0 right-0 w-48 h-48 pointer-events-none" style={{background:'radial-gradient(circle at 85% 15%, rgba(0,224,176,0.18) 0%, transparent 60%)'}} />
                <div className="absolute bottom-0 left-0 w-32 h-32 pointer-events-none" style={{background:'radial-gradient(circle at 10% 90%, rgba(0,120,184,0.15) 0%, transparent 60%)'}} />
                {/* Top line */}
                <div className="flex items-center justify-between mb-5">
                  <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Active Membership</p>
                  <span className="text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full" style={{background:'rgba(0,224,176,0.15)',color:'#00E0B0',border:'1px solid rgba(0,224,176,0.25)'}}>
                    {subPlan === 'annual' ? 'Annual' : 'Monthly'}
                  </span>
                </div>
                {/* Name + check */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{background:'rgba(0,224,176,0.15)',border:'1px solid rgba(0,224,176,0.25)'}}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00E0B0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div>
                    <p className="text-white text-2xl font-bold leading-none" style={{fontFamily:"'Oswald',sans-serif",letterSpacing:'-.01em'}}>PoolKeep Pro</p>
                    <p className="text-white/50 text-xs mt-1">
                      {subStatus === 'trialing' ? 'Trial' : subPlan === 'annual' ? '$99 / year' : '$9.99 / month'}
                    </p>
                  </div>
                </div>
                {/* Renewal */}
                {periodEnd && (
                  <div className="flex items-center gap-2 pt-4" style={{borderTop:'1px solid rgba(255,255,255,0.08)'}}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <p className="text-white/40 text-xs">
                      {subStatus === 'trialing' ? 'Trial ends' : 'Renews'}{' '}
                      {new Date(periodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Manage subscription */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-4">
                <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3">Manage Subscription</p>
                <div className="space-y-2">
                  <button
                    onClick={async () => {
                      const res = await fetch('/api/stripe/portal', { method: 'POST' })
                      const data = await res.json()
                      if (data.url) window.location.href = data.url
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-colors hover:bg-surface"
                    style={{background:'#F8FBFD'}}
                  >
                    <div className="flex items-center gap-3">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      <span className="text-sm font-medium text-text-primary">Change or cancel plan</span>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8AAABB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
              </div>
            </div>

            {/* What you have */}
            <div className="bg-white rounded-2xl px-5 py-4 shadow-sm border border-gray-100">
              <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3">Your Pro Features</p>
              <div className="space-y-2.5">
                {PRO_FEATURES.map((f, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{background:'rgba(0,120,184,0.1)'}}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <span className="text-sm text-text-primary">{f.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Current plan */}
            <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-text-muted">Your current plan</p>
                <p className="text-sm font-bold text-text-primary mt-0.5">Free</p>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full" style={{background:'#F0F6FA',color:'#8AAABB'}}>Free</span>
            </div>

            {/* Plan selector */}
            <div className="space-y-2.5">

              {/* Founding Member */}
              <button
                onClick={() => setBilling('founding')}
                className="w-full text-left rounded-2xl overflow-hidden transition-all"
                style={{
                  background: billing === 'founding' ? 'linear-gradient(135deg,#002D44 0%,#004D6B 50%,#005A52 100%)' : 'white',
                  border: `2px solid ${billing === 'founding' ? '#00E0B0' : '#E8F2F8'}`,
                  boxShadow: billing === 'founding' ? '0 6px 24px rgba(0,45,68,0.3)' : '0 1px 4px rgba(0,0,0,0.06)',
                }}
              >
                <div className="px-4 pt-4 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                          style={{background: billing === 'founding' ? 'rgba(0,224,176,0.2)' : 'rgba(0,120,184,0.08)', color: billing === 'founding' ? '#00E0B0' : '#0078B8'}}>
                          Founding Member · {FOUNDING_SPOTS_SHOWN} spots only
                        </span>
                      </div>
                      <p className="font-bold text-sm mb-0.5" style={{color: billing === 'founding' ? 'white' : '#1A2E3B'}}>Lock in 50% off — forever</p>
                      <p className="text-xs leading-relaxed" style={{color: billing === 'founding' ? 'rgba(255,255,255,0.55)' : '#8AAABB'}}>
                        $60 now · then $4.99/mo for life. Pays for itself in year one.
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold mb-0.5" style={{color: billing === 'founding' ? 'rgba(255,255,255,0.4)' : '#8AAABB'}}>then</p>
                      <div className="flex items-start gap-0.5 leading-none justify-end">
                        <span className="text-sm font-bold mt-0.5" style={{color: billing === 'founding' ? 'rgba(255,255,255,0.6)' : '#8AAABB', fontFamily:"'Oswald',sans-serif"}}>$</span>
                        <span className="text-3xl font-bold" style={{color: billing === 'founding' ? 'white' : '#1A2E3B', fontFamily:"'Oswald',sans-serif"}}>4.99</span>
                      </div>
                      <p className="text-[10px]" style={{color: billing === 'founding' ? 'rgba(255,255,255,0.4)' : '#8AAABB'}}>/mo forever</p>
                    </div>
                  </div>
                  {billing === 'founding' && (
                    <div className="mt-3 flex items-center gap-2 pt-3" style={{borderTop:'1px solid rgba(255,255,255,0.1)'}}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00E0B0" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="20 6 9 17 4 12"/></svg>
                      <p className="text-[11px]" style={{color:'rgba(255,255,255,0.5)'}}>$60 one-time + $4.99/mo · same cost as regular monthly in year one — then you save $60 every year after</p>
                    </div>
                  )}
                </div>
              </button>

              {/* Annual */}
              <button
                onClick={() => setBilling('annual')}
                className="w-full text-left rounded-2xl px-4 pt-3.5 transition-all"
                style={{
                  background: billing === 'annual' ? '#F0F8FF' : 'white',
                  border: `2px solid ${billing === 'annual' ? '#0078B8' : '#E8F2F8'}`,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  paddingBottom: billing === 'annual' ? 0 : 14,
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full"
                        style={{background:'rgba(0,120,184,0.1)', color:'#0078B8'}}>Most Popular</span>
                    </div>
                    <p className="font-bold text-sm text-text-primary">Annual</p>
                    <p className="text-xs text-text-muted">$8.25/mo — paid once a year</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-start gap-0.5 leading-none justify-end">
                      <span className="text-sm font-bold mt-0.5 text-text-muted" style={{fontFamily:"'Oswald',sans-serif"}}>$</span>
                      <span className="text-3xl font-bold text-text-primary" style={{fontFamily:"'Oswald',sans-serif"}}>99</span>
                    </div>
                    <p className="text-[10px] text-text-muted">/year</p>
                  </div>
                </div>
                {billing === 'annual' && (
                  <div className="mt-3 pb-3.5 space-y-1.5 pt-3" style={{borderTop:'1.5px solid #D8EAF5'}}>
                    {[
                      { label: 'Monthly cost', monthly: '$9.99', annual: '$8.25' },
                      { label: 'Billed today', monthly: '—', annual: '$99' },
                      { label: 'You save per year', monthly: '—', annual: '$20.88' },
                    ].map((row, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-text-muted">{row.label}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-text-faint w-12 text-right">{row.monthly}</span>
                          <span className="font-bold w-14 text-right" style={{color:'#0078B8'}}>{row.annual}</span>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-[10px] pt-1" style={{borderTop:'1px solid #D8EAF5'}}>
                      <span className="text-text-faint">vs monthly</span>
                      <span className="font-bold" style={{color:'#1DB869'}}>Like getting 2 months free every year</span>
                    </div>
                  </div>
                )}
              </button>

              {/* Monthly */}
              <button
                onClick={() => setBilling('monthly')}
                className="w-full text-left rounded-2xl px-4 py-3.5 transition-all"
                style={{
                  background: billing === 'monthly' ? '#F0F8FF' : 'white',
                  border: `2px solid ${billing === 'monthly' ? '#0078B8' : '#E8F2F8'}`,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm text-text-primary">Monthly</p>
                    <p className="text-xs text-text-muted">Cancel anytime</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-start gap-0.5 leading-none justify-end">
                      <span className="text-sm font-bold mt-0.5 text-text-muted" style={{fontFamily:"'Oswald',sans-serif"}}>$</span>
                      <span className="text-3xl font-bold text-text-primary" style={{fontFamily:"'Oswald',sans-serif"}}>9.99</span>
                    </div>
                    <p className="text-[10px] text-text-muted">/month</p>
                  </div>
                </div>
              </button>
            </div>

            {/* Features */}
            <div className="bg-white rounded-2xl px-5 py-4 shadow-sm border border-gray-100">
              <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3">Everything in Pro</p>
              <div className="space-y-2.5">
                {PRO_FEATURES.map((f, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{background:'rgba(0,120,184,0.1)'}}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <span className="text-sm text-text-primary">{f.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div>
              <button
                onClick={handleUpgrade}
                disabled={loading}
                className="w-full font-bold py-4 rounded-xl text-sm flex items-center justify-center gap-2 transition-opacity"
                style={{
                  background: billing === 'founding' ? 'linear-gradient(135deg,#00C49A,#0078B8)' : '#0078B8',
                  color: 'white',
                  opacity: loading ? 0.7 : 1,
                  boxShadow: loading ? 'none' : billing === 'founding' ? '0 4px 20px rgba(0,196,154,0.4)' : '0 4px 20px rgba(0,120,184,0.35)',
                }}
              >
                {loading
                  ? <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>}
                {loading ? 'Redirecting…' : billing === 'founding' ? 'Claim Founding Spot — $60 + $4.99/mo' : billing === 'annual' ? 'Get Pro — $99/year' : 'Get Pro — $9.99/month'}
              </button>
              <p className="text-text-faint text-xs text-center mt-2">
                {billing === 'founding' ? 'Rate locked for life · Secure checkout by Stripe' : 'Cancel anytime · Secure checkout by Stripe'}
              </p>
              <p className="text-text-faint text-[10px] text-center mt-1">
                By upgrading you agree to our{' '}
                <a href="/terms" className="underline">Terms</a>{' '}and{' '}
                <a href="/privacy" className="underline">Privacy Policy</a>
              </p>
              {upgradeError && <p className="text-red-500 text-xs text-center mt-2">{upgradeError}</p>}
            </div>

            {/* Pool Service Pro — coming soon */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
              <div className="px-5 pt-5 pb-5">
                <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full" style={{background:'rgba(0,120,184,0.08)',color:'#0078B8'}}>Coming Soon</span>
                <h2 className="text-text-primary text-xl font-bold mt-2 mb-1" style={{fontFamily:"'Oswald',sans-serif"}}>Pool Service Pro</h2>
                <p className="text-text-muted text-xs mb-4">For pool technicians and service companies managing multiple client pools</p>
                <div className="space-y-2.5 mb-5">
                  {SERVICE_FEATURES.map((f, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{background:'rgba(0,120,184,0.08)'}}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                      <span className="text-text-muted text-sm">{f}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleNotify}
                  disabled={notified || notifyLoading}
                  className="w-full font-bold py-3.5 rounded-xl text-sm transition-all border-2"
                  style={notified
                    ? {borderColor:'#1DB869',color:'#1DB869',background:'rgba(29,184,105,0.06)',cursor:'default'}
                    : {borderColor:'#0078B8',color:'#0078B8',background:'transparent',cursor:'pointer'}}
                >
                  {notifyLoading ? 'Saving…' : notified ? "✓ You're on the list" : 'Notify Me When Available'}
                </button>
              </div>
            </div>

            <p className="text-center text-xs text-text-faint px-4">
              Free plan stays free — always. Pro features are optional upgrades, never paywalled essentials.
            </p>
          </>
        )}
      </div>

      {/* Bottom tab bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-2">
        <div className="flex items-center justify-around py-2 max-w-md mx-auto">
          {[
            { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
            { id: 'history', label: 'History', path: '/history', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="12 8 12 12 14 14"/><path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"/></svg> },
            { id: 'log', label: '', path: '/log', icon: null },
            { id: 'share', label: 'Share', path: '/share', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> },
            { id: 'pro', label: 'Account', path: '/pro', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
          ].map(tab => {
            if (tab.id === 'log') return (
              <button key="log" onClick={() => router.push('/log')} className="w-14 h-14 rounded-full bg-pool-dark flex items-center justify-center shadow-lg -mt-5 border-4 border-white">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            )
            const active = tab.id === 'pro'
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
