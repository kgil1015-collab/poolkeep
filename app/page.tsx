import Link from 'next/link'

export default function LandingPage() {
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
          <span className="bg-red-500/25 border border-red-400/40 text-white/85 text-xs font-medium px-3 py-1 rounded-full">🔥 73 Founding Spots Left</span>
        </div>
        <h1 className="font-bold tracking-tight leading-tight mb-5" style={{fontFamily:"'Oswald',sans-serif",fontSize:'clamp(42px,7vw,72px)'}}>
          Stop Guessing,<br />Start Swimming.
        </h1>
        <p className="text-white/80 text-lg max-w-lg mx-auto mb-8 leading-relaxed">
          Enter your test results. Get exact doses in plain English.<br className="hidden sm:block" /> Log everything. Share with a pro in one tap.
        </p>
        {/* Primary CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-5">
          <Link href="/signup?founding=1" className="inline-block bg-teal text-pool-deep text-lg font-bold px-9 py-4 rounded-xl hover:opacity-90 transition-all hover:-translate-y-0.5 shadow-lg">
            Claim Founding Spot — $4.99/mo →
          </Link>
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

        <p className="text-sm text-white/50">
          Already joined by <strong className="text-white/80">127 homeowners</strong> saving $1,200+/year in service fees.
        </p>
      </section>

      {/* Stats bar */}
      <section className="bg-white border-b border-gray-100 py-8 px-6">
        <div className="max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { stat: '127', label: 'Pool owners' },
            { stat: '$1,200+', label: 'Avg. annual savings' },
            { stat: '4.9★', label: 'Average rating' },
            { stat: '< 30s', label: 'To log a test' },
          ].map(({ stat, label }) => (
            <div key={label}>
              <p className="text-2xl font-bold" style={{fontFamily:"'Oswald',sans-serif",color:'#003D5C'}}>{stat}</p>
              <p className="text-xs text-text-muted font-medium mt-0.5">{label}</p>
            </div>
          ))}
        </div>
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

      {/* Founding Member Pricing */}
      <section id="pricing" className="py-16 px-6 bg-white">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-block bg-red-50 border border-red-200 text-red-600 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4">Limited — 73 Spots Left</span>
            <h2 className="text-3xl font-bold tracking-tight" style={{fontFamily:"'Oswald',sans-serif"}}>Lock in the founding rate. Forever.</h2>
            <p className="text-text-muted text-sm mt-3 max-w-md mx-auto">Founding members lock in today&apos;s price for life — even when the price goes up. Start free, upgrade when you&apos;re ready.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Free */}
            <div className="bg-surface rounded-2xl p-6 border border-gray-100">
              <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-1">Free</p>
              <p className="text-4xl font-bold text-text-primary mb-1" style={{fontFamily:"'Oswald',sans-serif"}}>$0</p>
              <p className="text-xs text-text-muted mb-5">5 free tests to try it out</p>
              <div className="space-y-2.5 mb-6">
                {['5 water tests with full recommendations','1 pool','Treatment plan with exact doses','Share your results'].map((f, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{background:'rgba(29,184,105,0.12)'}}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#1DB869" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <span className="text-xs text-text-muted">{f}</span>
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
              <div className="flex items-baseline gap-1.5 mb-1">
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
              <Link href="/signup" className="rounded-2xl px-5 py-4 flex items-center justify-between transition-all group" style={{background:'#C8E6FF',border:'2px solid #0078B8',boxShadow:'0 2px 12px rgba(0,120,184,0.15)'}}>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{color:'#0078B8'}}>Pro · Monthly</p>
                  <p className="text-xl font-bold text-text-primary" style={{fontFamily:"'Oswald',sans-serif"}}>$9.99<span className="text-sm font-normal text-text-muted">/mo</span></p>
                  <p className="text-[11px] text-text-muted">Cancel anytime</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
              <Link href="/signup" className="rounded-2xl px-5 py-4 flex items-center justify-between transition-all group" style={{background:'#C8E6FF',border:'2px solid #0078B8',boxShadow:'0 2px 12px rgba(0,120,184,0.15)'}}>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{color:'#0078B8'}}>Pro · Annual</p>
                  <p className="text-xl font-bold text-text-primary" style={{fontFamily:"'Oswald',sans-serif"}}>$99<span className="text-sm font-normal text-text-muted">/yr</span></p>
                  <p className="text-[11px]"><span className="text-text-muted">$8.25/mo · </span><span className="font-bold" style={{color:'#1DB869'}}>save $21</span></p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            </div>
          </div>

          <p className="text-center text-xs text-text-muted mt-4">Start free. Upgrade anytime. Founding rate locked in forever.</p>
        </div>
      </section>

      {/* Get it on your phone */}
      <section className="py-16 px-6 bg-surface">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-pool-dark text-sm font-bold uppercase tracking-widest mb-3">Works Like a Native App</p>
          <h2 className="text-3xl font-bold tracking-tight mb-4" style={{fontFamily:"'Oswald',sans-serif"}}>Add PoolKeep to your home screen.</h2>
          <p className="text-text-muted text-sm mb-10 max-w-md mx-auto">No app store required. Add it to your phone in seconds and it works just like a regular app — even offline.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
            {/* iPhone */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{background:'rgba(0,120,184,0.08)'}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2" strokeLinecap="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2.5"/></svg>
                </div>
                <p className="font-bold text-sm text-text-primary">iPhone (Safari)</p>
              </div>
              <ol className="space-y-2">
                {[
                  'Open poolkeep.vercel.app in Safari',
                  'Tap the Share button at the bottom',
                  'Scroll down and tap "Add to Home Screen"',
                  'Tap Add — done',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-text-muted">
                    <span className="w-4 h-4 rounded-full bg-pool-dark text-white flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-bold">{i+1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
            {/* Android */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{background:'rgba(0,120,184,0.08)'}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                </div>
                <p className="font-bold text-sm text-text-primary">Android (Chrome)</p>
              </div>
              <ol className="space-y-2">
                {[
                  'Open poolkeep.vercel.app in Chrome',
                  'Tap the three-dot menu (top right)',
                  'Tap "Add to Home screen"',
                  'Tap Add — done',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-text-muted">
                    <span className="w-4 h-4 rounded-full bg-pool-dark text-white flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-bold">{i+1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-pool-dark text-sm font-bold uppercase tracking-widest mb-3">What Pool Owners Say</p>
            <h2 className="text-3xl font-bold tracking-tight" style={{fontFamily:"'Oswald',sans-serif"}}>Real pools. Real results.</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              {
                quote: "I was dumping chemicals in and crossing my fingers. PoolKeep told me exactly what to add and in what order. Water's been perfect for two months straight.",
                name: 'Dave M.',
                pool: '18,000 gal inground',
                stars: 5,
              },
              {
                quote: "Cancelled my monthly service call. Between PoolKeep and a test kit from Home Depot, I'm saving about $100 a month. The app pays for itself in a day.",
                name: 'Sarah K.',
                pool: '12,000 gal above ground',
                stars: 5,
              },
              {
                quote: "The share feature is underrated. I send my pool guy the report before he shows up and he knows exactly what's been going on. Saves us both time.",
                name: 'Marcus T.',
                pool: '25,000 gal salt pool',
                stars: 5,
              },
            ].map((t, i) => (
              <div key={i} className="bg-surface rounded-2xl p-5 border-l-4 border-teal flex flex-col gap-3">
                <div className="flex gap-0.5">
                  {Array.from({length: t.stars}).map((_, s) => (
                    <svg key={s} width="14" height="14" viewBox="0 0 24 24" fill="#F5A623" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  ))}
                </div>
                <p className="text-sm text-text-primary leading-relaxed flex-1">&ldquo;{t.quote}&rdquo;</p>
                <div>
                  <p className="text-sm font-bold text-text-primary">{t.name}</p>
                  <p className="text-xs text-text-muted">{t.pool}</p>
                </div>
              </div>
            ))}
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
              ['Cost per month', '$4.99', '$80–$200'],
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
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-pool-deep py-16 px-6 text-center">
        <div className="inline-block bg-red-500/20 border border-red-400/30 text-white/80 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-6">73 founding spots remaining</div>
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
          <a href="mailto:kgil1015@aol.com" className="hover:text-text-primary transition-colors">Contact</a>
        </p>
      </footer>
    </div>
  )
}
