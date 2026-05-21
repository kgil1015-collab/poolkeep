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

export default function ProPage() {
  const router = useRouter()
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual')
  const [loading, setLoading] = useState(false)
  const [upgradeError, setUpgradeError] = useState<string | null>(null)
  const [subStatus, setSubStatus] = useState<string | null>(null)
  const [subPlan, setSubPlan] = useState<string | null>(null)
  const [periodEnd, setPeriodEnd] = useState<string | null>(null)

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

  const isPro = true // TEMP PREVIEW — revert before launch

  async function handleUpgrade() {
    const priceId = billing === 'annual' ? PRICE_ANNUAL : PRICE_MONTHLY
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
        body: JSON.stringify({ priceId }),
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

        {/* Current plan */}
        {isPro ? (
          <div className="rounded-2xl overflow-hidden shadow-md" style={{background:'linear-gradient(135deg, #003D5C 0%, #005580 50%, #00967A 100%)'}}>
            <div className="px-5 pt-5 pb-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none" style={{background:'radial-gradient(circle at 90% 10%, rgba(0,224,176,0.2) 0%, transparent 65%)'}} />
              <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mb-3">Active Membership</p>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-white text-xl font-bold" style={{fontFamily:"'Oswald',sans-serif",letterSpacing:'-.01em'}}>PoolKeep Pro</p>
                  {periodEnd && (
                    <p className="text-white/55 text-xs mt-1">
                      {subStatus === 'trialing' ? 'Trial ends' : 'Renews'}{' '}
                      {new Date(periodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                </div>
                <span className="text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full shrink-0" style={{background:'rgba(0,224,176,0.2)',color:'#00E0B0',border:'1px solid rgba(0,224,176,0.3)'}}>
                  {subPlan === 'annual' ? 'Annual' : 'Monthly'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-text-muted">Your current plan</p>
              <p className="text-sm font-bold text-text-primary mt-0.5">Free</p>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full" style={{background:'#F0F6FA',color:'#8AAABB'}}>Free</span>
          </div>
        )}

        {/* Pro card */}
        <div className="bg-pool-deep rounded-2xl overflow-hidden shadow-lg" style={{boxShadow:'0 8px 32px rgba(0,61,92,0.25)'}}>
          {/* Gradient accent bar */}
          <div className="h-1 w-full" style={{background:'linear-gradient(90deg, #00E0B0 0%, #0078B8 60%, #005580 100%)'}} />
          {/* Badge */}
          <div className="px-5 pt-5 pb-4">
            {/* Billing toggle — inside card */}
            <div className="flex gap-1.5 rounded-xl p-1 mb-4" style={{background:'rgba(255,255,255,0.1)'}}>
              <button
                onClick={() => setBilling('monthly')}
                className="flex-1 py-1.5 text-xs font-bold rounded-lg transition-all"
                style={billing === 'monthly' ? {background:'white',color:'#003D5C'} : {background:'transparent',color:'rgba(255,255,255,0.5)'}}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling('annual')}
                className="flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
                style={billing === 'annual' ? {background:'white',color:'#003D5C'} : {background:'transparent',color:'rgba(255,255,255,0.5)'}}
              >
                Annual
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{background:'rgba(0,224,176,0.25)',color:'#00E0B0'}}>Save $21</span>
              </button>
            </div>

            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full" style={{background:'rgba(0,224,176,0.15)',color:'#00E0B0'}}>Most Popular</span>
                <h2 className="text-white text-xl font-bold mt-2" style={{fontFamily:"'Oswald',sans-serif"}}>Pro</h2>
              </div>
              <div className="text-right">
                {billing === 'annual' ? (
                  <>
                    <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">Billed annually</p>
                    <div className="flex items-start gap-0.5 mt-1 leading-none">
                      <span className="text-white/60 text-sm font-bold mt-1" style={{fontFamily:"'Oswald',sans-serif"}}>$</span>
                      <span className="text-white text-4xl font-bold" style={{fontFamily:"'Oswald',sans-serif"}}>99</span>
                    </div>
                    <p className="text-white/50 text-xs mt-0.5">$8.25 / month</p>
                  </>
                ) : (
                  <>
                    <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">Billed monthly</p>
                    <div className="flex items-start gap-0.5 mt-1 leading-none">
                      <span className="text-white/60 text-sm font-bold mt-1" style={{fontFamily:"'Oswald',sans-serif"}}>$</span>
                      <span className="text-white text-4xl font-bold" style={{fontFamily:"'Oswald',sans-serif"}}>9.99</span>
                    </div>
                    <p className="text-white/50 text-xs mt-0.5">per month</p>
                  </>
                )}
              </div>
            </div>

            {/* Pro features */}
            <div className="space-y-2.5 mb-5">
              {PRO_FEATURES.map((f, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{background:'rgba(0,224,176,0.2)'}}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#00E0B0" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <span className="text-white/85 text-sm">{f.text}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            {isPro ? (
              <div className="w-full font-bold py-4 rounded-xl text-sm flex items-center justify-center gap-2" style={{background:'rgba(0,224,176,0.15)',color:'#00E0B0'}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                You&apos;re on Pro
              </div>
            ) : (
              <button
                onClick={handleUpgrade}
                disabled={loading || !PRICE_MONTHLY}
                className="w-full font-bold py-4 rounded-xl text-sm flex items-center justify-center gap-2 transition-opacity"
                style={{background:'#00E0B0', color:'#003D5C', opacity: loading ? 0.7 : 1, boxShadow: loading ? 'none' : '0 4px 20px rgba(0,224,176,0.45)'}}
              >
                {loading ? (
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                )}
                {loading ? 'Redirecting…' : `Upgrade to Pro`}
              </button>
            )}
            {!isPro && <p className="text-white/40 text-xs text-center mt-2">Cancel anytime · Secure checkout by Stripe</p>}
            {upgradeError && (
              <p className="text-red-300 text-xs text-center mt-2">{upgradeError}</p>
            )}
          </div>

          {/* What's included in Free — comparison */}
          <div className="px-5 pb-5">
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-3">Free plan includes</p>
            <div className="space-y-2">
              {FREE_FEATURES.map((f, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{background:'rgba(255,255,255,0.08)'}}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <span className="text-white/45 text-sm">{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pool Service Pro — coming soon */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
          <div className="px-5 pt-5 pb-5">
            <div className="flex items-start justify-between gap-3 mb-1">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full" style={{background:'rgba(0,120,184,0.08)',color:'#0078B8'}}>Coming Soon</span>
                <h2 className="text-text-primary text-xl font-bold mt-2" style={{fontFamily:"'Oswald',sans-serif"}}>Pool Service Pro</h2>
                <p className="text-text-muted text-xs mt-1">For pool technicians and service companies managing multiple client pools</p>
              </div>
            </div>

            <div className="space-y-2.5 mt-4 mb-5">
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
              disabled
              className="w-full font-bold py-3.5 rounded-xl text-sm opacity-50 cursor-not-allowed border-2"
              style={{borderColor:'#0078B8',color:'#0078B8',background:'transparent'}}
            >
              Notify Me When Available
            </button>
          </div>
        </div>

        {/* Trust note */}
        <p className="text-center text-xs text-text-faint px-4">
          Free plan stays free — always. Pro features are optional upgrades, never paywalled essentials.
        </p>
      </div>

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
