import Link from 'next/link'

export function LearnNav() {
  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-5 sm:px-6 py-4 bg-pool-deep border-b border-white/5">
      <Link href="/" className="flex items-center gap-2">
        <svg viewBox="28 8 144 175" width="24" height="30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="ld" x1=".35" y1="0" x2=".65" y2="1"><stop offset="0%" stopColor="#92D5F5"/><stop offset="42%" stopColor="#3A8AC8"/><stop offset="100%" stopColor="#052C4E"/></linearGradient>
            <clipPath id="lc"><path d="M100 8C100 8 28 88 28 124C28 163 61 183 100 183C139 183 172 163 172 124C172 88 100 8 100 8Z"/></clipPath>
          </defs>
          <path d="M100 8C100 8 28 88 28 124C28 163 61 183 100 183C139 183 172 163 172 124C172 88 100 8 100 8Z" fill="url(#ld)"/>
          <g clipPath="url(#lc)" fill="none" stroke="white" strokeLinecap="round">
            <path d="M46 145Q100 122 154 145" strokeWidth="4.5" opacity=".82"/>
            <path d="M38 160Q100 136 162 160" strokeWidth="4" opacity=".62"/>
            <path d="M50 173Q100 152 150 173" strokeWidth="3.5" opacity=".42"/>
          </g>
        </svg>
        <span className="text-white text-xl tracking-tight" style={{fontFamily:"'Space Grotesk',sans-serif",letterSpacing:'-.01em'}}>
          <span style={{fontWeight:300}}>Pool</span><span style={{fontWeight:800}}>Keep</span>
        </span>
      </Link>
      <div className="flex items-center gap-2 sm:gap-3">
        <Link href="/learn" className="hidden sm:inline-block text-white/70 text-sm font-medium hover:text-white transition-colors px-3 py-2 rounded-lg">
          Learn
        </Link>
        <Link href="/login" className="text-white/70 text-sm font-medium hover:text-white transition-colors px-3 py-2 rounded-lg">
          Sign In
        </Link>
        <Link href="/signup" className="bg-teal text-pool-deep text-sm font-bold px-4 py-2 rounded-full hover:opacity-90 transition-opacity">
          Start Free
        </Link>
      </div>
    </nav>
  )
}

export function LearnCTA() {
  return (
    <section className="bg-pool-deep text-center px-6 py-16">
      <p className="text-teal text-sm font-bold uppercase tracking-widest mb-3">Put It Into Practice</p>
      <h2 className="text-3xl font-bold text-white tracking-tight mb-3" style={{fontFamily:"'Oswald',sans-serif"}}>Know exactly what your pool needs.</h2>
      <p className="text-white/70 mb-8 max-w-md mx-auto">Enter your test readings and PoolKeep gives you exact doses for your pool size, in plain English.</p>
      <Link href="/signup" className="inline-block bg-teal text-pool-deep text-lg font-bold px-9 py-4 rounded-xl hover:opacity-90 transition-all">
        Try PoolKeep Free →
      </Link>
      <p className="mt-4 text-xs text-white/40">5 free tests · No credit card to start</p>
    </section>
  )
}

export function LearnFooter() {
  return (
    <footer className="bg-white border-t border-gray-100 py-6 px-6 text-center">
      <p className="text-xs text-text-muted">
        © {new Date().getFullYear()} PoolKeep &nbsp;·&nbsp;
        <Link href="/learn" className="hover:text-text-primary transition-colors">Learn</Link>
        &nbsp;·&nbsp;
        <Link href="/privacy" className="hover:text-text-primary transition-colors">Privacy</Link>
        &nbsp;·&nbsp;
        <Link href="/terms" className="hover:text-text-primary transition-colors">Terms</Link>
      </p>
      <p className="text-[11px] text-text-faint mt-2 max-w-md mx-auto">
        General guidance only. Always follow the chemical manufacturer&apos;s label and wear protective gear.
      </p>
    </footer>
  )
}
