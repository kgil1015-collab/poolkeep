import Link from 'next/link'
import Image from 'next/image'

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
          <Link href="/signup" className="bg-teal text-pool-deep text-sm font-bold px-4 py-2 rounded-full hover:opacity-90 transition-opacity">
            Get Started Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-pool-deep text-white text-center px-6 py-20">
        <div className="mb-7">
          <div className="bg-white rounded-3xl p-6 inline-block shadow-xl">
            <Image src="/logo.png" alt="PoolKeep" width={220} height={220} style={{objectFit:'contain'}} />
          </div>
        </div>
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
        <Link href="/signup" className="inline-block bg-teal text-pool-deep text-lg font-bold px-9 py-4 rounded-xl hover:opacity-90 transition-all hover:-translate-y-0.5 shadow-lg">
          Claim Your Founding Spot →
        </Link>
        <p className="mt-4 text-sm text-white/50">
          Already joined by <strong className="text-white/80">127 homeowners</strong> saving $1,200+/year in service fees.
        </p>
        <Link href="/login" className="block mt-4 text-sm text-white/50 underline hover:text-white/70 transition-colors">
          See the app first →
        </Link>
      </section>

      {/* How it works */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-pool-dark text-sm font-bold uppercase tracking-widest mb-3">How It Works</p>
          <h2 className="text-3xl font-extrabold text-text-primary tracking-tight mb-12">Crystal clear water in three steps.</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { n: '1', title: 'Test Your Water', desc: 'Use any test kit or strips. Enter your 6 readings in under 30 seconds.' },
              { n: '2', title: 'Get Your Exact Plan', desc: 'PoolKeep calculates precise doses adjusted for your pool size, climate, and current conditions.' },
              { n: '3', title: 'Log, Track & Share', desc: 'Every test is saved automatically. Send a pro a full service report in one tap.' },
            ].map(s => (
              <div key={s.n} className="text-center px-2">
                <div className="w-13 h-13 rounded-full bg-pool-dark text-white text-xl font-extrabold flex items-center justify-center mx-auto mb-4" style={{width:52,height:52}}>{s.n}</div>
                <h3 className="text-lg font-bold text-text-primary mb-2">{s.title}</h3>
                <p className="text-text-muted text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-pool-deep py-16 px-6 text-center">
        <h2 className="text-3xl font-extrabold text-white tracking-tight mb-4">Ready to take back your weekends?</h2>
        <p className="text-white/70 mb-8 max-w-md mx-auto">Join 127 homeowners who stopped guessing and started swimming.</p>
        <Link href="/signup" className="inline-block bg-teal text-pool-deep text-lg font-bold px-9 py-4 rounded-xl hover:opacity-90 transition-all">
          Get Started Free →
        </Link>
      </section>
    </div>
  )
}
