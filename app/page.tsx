import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

// Dynamic so the auth check runs on every request (redirect for signed-in users).
// The spots counter is fetched inside and is fast enough per-request.
export const dynamic = 'force-dynamic'

const FOUNDING_TOTAL = 200   // Total founding spots available
const FOUNDING_FLOOR = 12    // Never show fewer than this — avoid showing "0 left"

async function getSpotsLeft(): Promise<number> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('plan', 'founding')
    const taken = count ?? 0
    return Math.max(FOUNDING_FLOOR, FOUNDING_TOTAL - taken)
  } catch {
    return FOUNDING_TOTAL // safe fallback if DB is unreachable
  }
}

function spotsLabel(n: number): string {
  if (n <= 5)  return `⚠️ Only ${n} founding spots left`
  if (n <= 15) return `🔥 Almost gone — ${n} spots left`
  return `🔥 ${n} Founding Spots Left`
}

function spotsBadgeLabel(n: number): string {
  if (n <= 5)  return `⚠️ Only ${n} Spots Left`
  if (n <= 15) return `Hurry — ${n} Spots Left`
  return `Limited — ${n} Spots Left`
}

export default async function LandingPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  const spotsLeft = await getSpotsLeft()
  return (
    <div className="min-h-screen bg-white">

      {/* Nav */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-pool-deep border-b border-white/5">
        <div className="flex items-center gap-2">
          <svg viewBox="28 8 144 175" width="24" height="30" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="nd" x1=".35" y1="0" x2=".65" y2="1"><stop offset="0%" stopColor="#92D5F5"/><stop offset="42%" stopColor="#3A8AC8"/><stop offset="100%" stopColor="#052C4E"/></linearGradient>
              <radialGradient id="ng" cx="42%" cy="25%" r="40%"><stop offset="0%" stopColor="#fff" stopOpacity=".5"/><stop offset="100%" stopColor="#fff" stopOpacity="0"/></radialGradient>
              <clipPath id="nc"><path d="M100 8C100 8 28 88 28 124C28 163 61 183 100 183C139 183 172 163 172 124C172 88 100 8 100 8Z"/></clipPath>
            </defs>
            <path d="M100 8C100 8 28 88 28 124C28 163 61 183 100 183C139 183 172 163 172 124C172 88 100 8 100 8Z" fill="url(#nd)"/>
            <path d="M100 8C100 8 28 88 28 124C28 163 61 183 100 183C139 183 172 163 172 124C172 88 100 8 100 8Z" fill="url(#ng)"/>
            <g clipPath="url(#nc)" fill="none" stroke="white" strokeLinecap="round">
              <path d="M46 145Q100 122 154 145" strokeWidth="4.5" opacity=".82"/>
              <path d="M38 160Q100 136 162 160" strokeWidth="4" opacity=".62"/>
              <path d="M50 173Q100 152 150 173" strokeWidth="3.5" opacity=".42"/>
            </g>
          </svg>
          <span className="text-white text-xl tracking-tight" style={{fontFamily:"'Space Grotesk',sans-serif",letterSpacing:'-.01em'}}>
            <span style={{fontWeight:300}}>Pool</span><span style={{fontWeight:800}}>Keep</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-white/70 text-sm font-medium hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/8">
            Sign In
          </Link>
          <Link href="/signup?founding=1" className="bg-teal text-pool-deep text-sm font-bold px-4 py-2 rounded-full hover:opacity-90 transition-opacity">
            Claim Founding Spot
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-pool-deep text-white text-center px-6 py-20">
        <div className="flex justify-center gap-2 flex-wrap mb-6">
          <span className="bg-white/10 border border-white/20 text-white/85 text-xs font-medium px-3 py-1 rounded-full">✦ Works on Any Phone</span>
          <span className="bg-white/10 border border-white/20 text-white/85 text-xs font-medium px-3 py-1 rounded-full">✦ No Hardware Required</span>
          <span className="bg-red-500/25 border border-red-400/40 text-white/85 text-xs font-medium px-3 py-1 rounded-full">{spotsLabel(spotsLeft)}</span>
        </div>
        <h1 className="font-bold tracking-tight leading-tight mb-5" style={{fontFamily:"'Oswald',sans-serif",fontSize:'clamp(42px,7vw,72px)'}}>
          Stop Guessing,<br />Start Swimming.
        </h1>
        <p className="text-white/80 text-lg max-w-lg mx-auto mb-8 leading-relaxed">
          Enter your test results. Get exact doses in plain English.<br className="hidden sm:block" /> Log everything. Share with a pro in one tap.
        </p>
        {/* Primary CTAs */}
        <div className="flex flex-col sm:flex-row items-start justify-center gap-3 mb-5">
          <div className="flex flex-col items-center gap-1">
            <Link href="/signup?founding=1" className="inline-block bg-teal text-pool-deep text-lg font-bold px-9 py-4 rounded-xl hover:opacity-90 transition-all hover:-translate-y-0.5 shadow-lg">
              Claim Founding Spot →
            </Link>
            <p className="text-[11px]" style={{color:'rgba(0,224,176,0.7)'}}>💳 $60 once · then $4.99/mo forever</p>
          </div>
          <Link href="/signup" className="inline-block bg-white/10 border border-white/25 text-white text-lg font-bold px-9 py-4 rounded-xl hover:bg-white/20 transition-all">
            Join Free
          </Link>
        </div>

        {/* Secondary plan options */}
        <div className="flex items-center justify-center gap-3 flex-wrap mb-5">
          <Link href="/signup" className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full hover:opacity-80 transition-all" style={{background:'rgba(245,166,35,0.18)',color:'#F5C842',border:'1px solid rgba(245,166,35,0.35)'}}>
            <span>Pro Monthly</span>
            <span className="opacity-50">·</span>
            <span className="font-bold">$9.99/mo</span>
          </Link>
          <Link href="/signup" className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full hover:opacity-80 transition-all" style={{background:'rgba(245,166,35,0.18)',color:'#F5C842',border:'1px solid rgba(245,166,35,0.35)'}}>
            <span>Pro Annual</span>
            <span className="opacity-50">·</span>
            <span className="font-bold">$99/yr</span>
            <span className="text-[10px] font-bold ml-1" style={{color:'#00E0B0'}}>SAVE $21</span>
          </Link>
        </div>

        <p className="mt-2 text-xs text-white/35">Start free · Upgrade anytime · Founding rate locked in forever</p>
      </section>

      {/* How it works */}
      <section className="py-16 px-6 bg-surface">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-pool-dark text-sm font-bold uppercase tracking-widest mb-3">How It Works</p>
          <h2 className="text-3xl font-bold tracking-tight mb-12" style={{fontFamily:"'Oswald',sans-serif"}}>Crystal clear water in three steps.</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { n: '1', title: 'Test Your Water', desc: 'Use any test kit or strips. Enter your 6 readings in under 30 seconds.' },
              { n: '2', title: 'Get Your Exact Plan', desc: 'PoolKeep calculates precise doses adjusted for your pool size, climate, and current conditions.' },
              { n: '3', title: 'Log, Track & Share', desc: 'Every test is saved automatically. Send a pro a full service report in one tap.' },
            ].map(s => (
              <div key={s.n} className="text-center px-2">
                <div className="w-13 h-13 rounded-full bg-pool-dark text-white text-xl font-extrabold flex items-center justify-center mx-auto mb-4" style={{width:52,height:52}}>{s.n}</div>
                <h3 className="text-xl font-bold text-text-primary mb-2" style={{fontFamily:"'Oswald',sans-serif"}}>{s.title}</h3>
                <p className="text-text-muted text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Philosophy */}
      <section className="py-16 px-6 bg-white border-t border-gray-100">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-pool-dark text-sm font-bold uppercase tracking-widest mb-3">Our Philosophy</p>
            <h2 className="text-3xl font-bold tracking-tight" style={{fontFamily:"'Oswald',sans-serif"}}>Minimum effective dose.<br/>Maximum peace of mind.</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
            {[
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
                title: 'Test less, not more',
                desc: 'We tell you exactly when to test and what to test for. No more daily strip obsession — we save your kit for when it actually matters.',
              },
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6 9 4 13 4 16a8 8 0 0 0 16 0c0-3-2-7-8-14z"/></svg>,
                title: 'Add only what you need',
                desc: 'Most pools are overtreated. PoolKeep gives precise doses based on your actual readings — not guesswork or store upsells.',
              },
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
                title: 'A few habits, consistently',
                desc: 'Stable chlorine, balanced pH, a clean filter, and a weekly brush. That\'s 95% of pool care. We make sure those four things are always handled.',
              },
            ].map((item, i) => (
              <div key={i} className="text-center px-2">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{background:'rgba(0,120,184,0.08)',color:'#0078B8'}}>
                  {item.icon}
                </div>
                <h3 className="text-base font-bold text-text-primary mb-2" style={{fontFamily:"'Oswald',sans-serif"}}>{item.title}</h3>
                <p className="text-text-muted text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl px-6 py-5 text-center" style={{background:'linear-gradient(135deg,#F0F9FF,#E8F5F0)',border:'1.5px solid #C8E0EE'}}>
            <p className="text-sm font-semibold text-text-primary leading-relaxed max-w-xl mx-auto">
              &ldquo;PoolKeep was built by a pool owner who got tired of spending Saturdays guessing at chemicals. No upsells. No mystery products. Just honest guidance that keeps your water clear with the least amount of work possible.&rdquo;
            </p>
          </div>
        </div>
      </section>

      {/* Founding Member Pricing */}
      <section id="pricing" className="py-16 px-6 bg-white">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-block bg-red-50 border border-red-200 text-red-600 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4">{spotsBadgeLabel(spotsLeft)}</span>
            <h2 className="text-3xl font-bold tracking-tight" style={{fontFamily:"'Oswald',sans-serif"}}>Lock in the founding rate. Forever.</h2>
            <p className="text-text-muted text-sm mt-3 max-w-md mx-auto">Founding members lock in today&apos;s price for life — even when the price goes up. Start free, upgrade when you&apos;re ready.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Free */}
            <div className="rounded-2xl p-6" style={{background:'linear-gradient(160deg,#F0FAF6,#E8F5FF)',border:'2px solid #C8E8D8'}}>
              <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{color:'#2A7A5A'}}>Free</p>
              <p className="text-4xl font-bold text-text-primary mb-1" style={{fontFamily:"'Oswald',sans-serif"}}>$0</p>
              <p className="text-xs font-medium mb-5" style={{color:'#3A6B5A'}}>5 free tests to try it out</p>
              <div className="space-y-2.5 mb-6">
                {['5 water tests with full recommendations','1 pool','Treatment plan with exact doses','Share your results'].map((f, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{background:'rgba(29,184,105,0.25)'}}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#1A9A5A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <span className="text-xs font-medium" style={{color:'#1A3A2A'}}>{f}</span>
                  </div>
                ))}
              </div>
              <Link href="/signup" className="block w-full text-center text-sm font-bold py-3 rounded-xl hover:opacity-90 transition-opacity" style={{background:'linear-gradient(135deg,#F5A623,#F7C548)',color:'#1A2E3B',boxShadow:'0 4px 16px rgba(245,166,35,0.35)'}}>
                Start Free →
              </Link>
            </div>

            {/* Pro - Founding */}
            <div className="rounded-2xl p-6 border-2 relative overflow-hidden" style={{background:'#003D5C', borderColor:'#00E0B0'}}>
              <div className="absolute top-3 right-3 bg-teal text-pool-deep text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">Founding Rate</div>
              <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-1">Pro</p>
              <div className="flex items-baseline mb-1">
                <p className="text-4xl font-bold text-white" style={{fontFamily:"'Oswald',sans-serif"}}>$4.99</p>
                <span className="text-white/60 text-sm">/mo forever</span>
              </div>
              <p className="text-xs text-white/50 mb-1">$60 one-time to join · then $4.99/mo locked for life</p>
              <p className="text-[10px] text-teal font-semibold mb-5">Your rate is locked in forever</p>
              <div className="space-y-2.5">
                {['Unlimited water tests','Up to 5 pools','Full trend charts & history','Priority support','Lock in founding price for life'].map((f, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{background:'rgba(0,224,176,0.2)'}}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#00E0B0" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <span className="text-xs text-white/80">{f}</span>
                  </div>
                ))}
              </div>
              <Link href="/signup?founding=1" className="block w-full text-center mt-6 bg-teal text-pool-deep text-sm font-bold py-3 rounded-xl hover:opacity-90 transition-opacity">
                Claim This Rate →
              </Link>
            </div>
          </div>

          {/* Standard Pro plans */}
          <div className="mt-4">
            <p className="text-center text-xs font-semibold mb-3" style={{color:'#B97A00'}}>Prefer a standard plan? No one-time fee.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link href="/signup" className="rounded-2xl px-5 py-4 flex items-center justify-between transition-all group" style={{background:'#EEF6FF',border:'2px solid #A8CFEA',boxShadow:'0 2px 8px rgba(0,120,184,0.08)'}}>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{color:'#0078B8'}}>Pro · Monthly</p>
                  <p className="text-xl font-bold text-text-primary" style={{fontFamily:"'Oswald',sans-serif"}}>$9.99<span className="text-sm font-normal text-text-muted">/mo</span></p>
                  <p className="text-[11px] text-text-muted">Cancel anytime</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
              <Link href="/signup" className="rounded-2xl px-5 py-4 flex items-center justify-between transition-all group" style={{background:'#EEF6FF',border:'2px solid #A8CFEA',boxShadow:'0 2px 8px rgba(0,120,184,0.08)'}}>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{color:'#0078B8'}}>Pro · Annual</p>
                  <p className="text-xl font-bold text-text-primary" style={{fontFamily:"'Oswald',sans-serif"}}>$99<span className="text-sm font-normal text-text-muted">/yr</span></p>
                  <p className="text-[11px]"><span className="text-text-muted">$8.25/mo · </span><span className="font-bold" style={{color:'#1DB869'}}>save $21</span></p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            </div>
          </div>

        </div>
      </section>

      {/* Feature comparison */}
      <section className="py-16 px-6 bg-surface">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-pool-dark text-sm font-bold uppercase tracking-widest mb-3">Why PoolKeep</p>
            <h2 className="text-3xl font-bold tracking-tight" style={{fontFamily:"'Oswald',sans-serif"}}>Everything you need. Nothing you don&apos;t.</h2>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-3 text-center text-xs font-bold uppercase tracking-widest py-3 px-4 border-b border-gray-100" style={{background:'#F8FBFD'}}>
              <span className="text-text-muted">Feature</span>
              <span style={{color:'#003D5C'}}>PoolKeep</span>
              <span className="text-text-muted">Hiring a Pro</span>
            </div>
            {[
              ['Health score 0–100', true, false],
              ['Exact chemical doses', true, true],
              ['Step-by-step instructions', true, false],
              ['Full test history', true, false],
              ['Shareable reports', true, true],
              ['Works on your schedule', true, false],
              ['Cost per month', 'From $4.99*', '$80–$200'],
            ].map(([feature, pool, pro], i) => (
              <div key={i} className={`grid grid-cols-3 items-center text-sm px-4 py-3.5 ${i % 2 === 0 ? '' : 'bg-surface/60'}`}>
                <span className="text-text-muted text-xs">{feature}</span>
                <span className="text-center">
                  {typeof pool === 'boolean'
                    ? pool
                      ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full" style={{background:'rgba(29,184,105,0.12)'}}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1DB869" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
                      : <span className="inline-block w-4 h-0.5 rounded bg-gray-200 mx-auto" />
                    : <span className="text-xs font-bold" style={{color:'#003D5C'}}>{pool}</span>
                  }
                </span>
                <span className="text-center">
                  {typeof pro === 'boolean'
                    ? pro
                      ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full" style={{background:'rgba(29,184,105,0.12)'}}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1DB869" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
                      : <span className="inline-block w-4 h-0.5 rounded bg-gray-200 mx-auto" />
                    : <span className="text-xs text-text-muted">{pro}</span>
                  }
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-text-muted mt-3 text-center">* $4.99/mo is the founding member rate ($60 one-time to join). Regular plans from $9.99/mo.</p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-pool-deep py-16 px-6 text-center">
        <div className="inline-block bg-red-500/20 border border-red-400/30 text-white/80 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-6">{spotsLabel(spotsLeft)}</div>
        <h2 className="text-3xl font-bold text-white tracking-tight mb-3" style={{fontFamily:"'Oswald',sans-serif"}}>Your pool should be the best part of summer.</h2>
        <p className="text-white/70 mb-2 max-w-md mx-auto">Start free. Lock in $4.99/mo when you upgrade. That rate stays yours forever.</p>
        <p className="text-white/40 text-xs mb-8">Regular price will increase as founding spots fill.</p>
        <Link href="/signup?founding=1" className="inline-block bg-teal text-pool-deep text-lg font-bold px-9 py-4 rounded-xl hover:opacity-90 transition-all">
          Claim Your Founding Spot →
        </Link>
        <p className="mt-4 text-xs text-white/40">Try free · No credit card to start · Upgrade when you&apos;re ready</p>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-6 px-6 text-center">
        <p className="text-xs text-text-muted">
          © {new Date().getFullYear()} PoolKeep &nbsp;·&nbsp;
          <Link href="/privacy" className="hover:text-text-primary transition-colors">Privacy</Link>
          &nbsp;·&nbsp;
          <Link href="/terms" className="hover:text-text-primary transition-colors">Terms</Link>
          &nbsp;·&nbsp;
          <a href="mailto:support@poolkeep.app" className="hover:text-text-primary transition-colors">Contact</a>
        </p>
      </footer>
    </div>
  )
}
