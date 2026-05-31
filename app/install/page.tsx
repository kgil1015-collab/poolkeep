import Link from 'next/link'

export const metadata = {
  title: 'Get PoolKeep on Your Phone',
  description: 'Add PoolKeep to your home screen — smart pool maintenance in your pocket. No App Store needed.',
}

export default function InstallPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{background:'#002D44', maxWidth:480, margin:'0 auto'}}>

      {/* Header */}
      <div className="flex flex-col items-center px-6 pt-12 pb-8 text-center">
        {/* Logo */}
        <div className="mb-5">
          <svg viewBox="28 8 144 175" width="56" height="70" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="id" x1=".35" y1="0" x2=".65" y2="1"><stop offset="0%" stopColor="#92D5F5"/><stop offset="42%" stopColor="#3A8AC8"/><stop offset="100%" stopColor="#052C4E"/></linearGradient>
              <radialGradient id="ig" cx="42%" cy="25%" r="40%"><stop offset="0%" stopColor="#fff" stopOpacity=".5"/><stop offset="100%" stopColor="#fff" stopOpacity="0"/></radialGradient>
              <clipPath id="ic"><path d="M100 8C100 8 28 88 28 124C28 163 61 183 100 183C139 183 172 163 172 124C172 88 100 8 100 8Z"/></clipPath>
            </defs>
            <path d="M100 8C100 8 28 88 28 124C28 163 61 183 100 183C139 183 172 163 172 124C172 88 100 8 100 8Z" fill="url(#id)"/>
            <path d="M100 8C100 8 28 88 28 124C28 163 61 183 100 183C139 183 172 163 172 124C172 88 100 8 100 8Z" fill="url(#ig)"/>
            <g clipPath="url(#ic)" fill="none" stroke="white" strokeLinecap="round">
              <path d="M46 145Q100 122 154 145" strokeWidth="4.5" opacity=".82"/>
              <path d="M38 160Q100 136 162 160" strokeWidth="4" opacity=".62"/>
              <path d="M50 173Q100 152 150 173" strokeWidth="3.5" opacity=".42"/>
            </g>
          </svg>
        </div>

        <h1 className="text-white text-3xl font-bold mb-2" style={{fontFamily:"'Oswald',sans-serif",letterSpacing:'-.01em'}}>
          Pool<span style={{color:'#00CCA3'}}>Keep</span>
        </h1>
        <p className="text-white/60 text-sm mb-1">Smart pool maintenance — in your pocket.</p>
        <p className="text-white/40 text-xs">No app store. No downloads. Always free to try.</p>

        {/* URL badge */}
        <div className="mt-5 px-5 py-2.5 rounded-full text-sm font-bold tracking-wide" style={{background:'rgba(0,204,163,0.15)',border:'1.5px solid rgba(0,204,163,0.35)',color:'#00CCA3'}}>
          poolkeep.app
        </div>
      </div>

      {/* Divider wave */}
      <div style={{background:'rgba(255,255,255,0.04)',height:1,margin:'0 24px'}} />

      {/* Install steps */}
      <div className="flex-1 px-6 py-8 space-y-6">

        {/* iOS */}
        <div className="rounded-2xl p-5" style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.10)'}}>
          <div className="flex items-center gap-2.5 mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
            <div>
              <p className="font-bold text-white text-sm">iPhone / iPad</p>
              <p className="text-white/40 text-xs">Open in Safari</p>
            </div>
          </div>
          {[
            {n:1, text:'Open poolkeep.app in Safari', highlight:'poolkeep.app'},
            {n:2, text:'Tap the Share button ↑ at the bottom of the screen', highlight:'Share button ↑'},
            {n:3, text:'Scroll down and tap "Add to Home Screen"', highlight:'"Add to Home Screen"'},
            {n:4, text:'Tap "Add" in the top right — you\'re done!', highlight:'"Add"'},
          ].map(({n, text, highlight}) => (
            <div key={n} className="flex items-start gap-3 mb-3 last:mb-0">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white mt-0.5" style={{background:'#0078B8'}}>
                {n}
              </div>
              <p className="text-sm leading-snug pt-1" style={{color:'rgba(255,255,255,0.70)'}}>
                {text.split(highlight).map((part, i, arr) => (
                  i < arr.length - 1
                    ? <span key={i}>{part}<strong className="text-white">{highlight}</strong></span>
                    : <span key={i}>{part}</span>
                ))}
              </p>
            </div>
          ))}
        </div>

        {/* Android */}
        <div className="rounded-2xl p-5" style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.10)'}}>
          <div className="flex items-center gap-2.5 mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24c-1.44-.5-3.08-.77-4.83-.77s-3.39.27-4.83.77L4.99 5.67c-.19-.29-.54-.37-.83-.22-.31.16-.42.54-.26.85L5.74 9.5C3.03 11.25 1.2 14.44 1 18h22c-.2-3.56-2.03-6.75-5.4-8.52zM7 15.25c-.69 0-1.25-.56-1.25-1.25S6.31 12.75 7 12.75s1.25.56 1.25 1.25S7.69 15.25 7 15.25zm10 0c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25z"/></svg>
            <div>
              <p className="font-bold text-white text-sm">Android</p>
              <p className="text-white/40 text-xs">Open in Chrome</p>
            </div>
          </div>
          {[
            {n:1, text:'Open poolkeep.app in Chrome', highlight:'poolkeep.app'},
            {n:2, text:'Tap the menu ⋮ in the top right corner', highlight:'menu ⋮'},
            {n:3, text:'Tap "Add to Home Screen"', highlight:'"Add to Home Screen"'},
            {n:4, text:'Tap "Add" to confirm — you\'re done!', highlight:'"Add"'},
          ].map(({n, text, highlight}) => (
            <div key={n} className="flex items-start gap-3 mb-3 last:mb-0">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white mt-0.5" style={{background:'#0078B8'}}>
                {n}
              </div>
              <p className="text-sm leading-snug pt-1" style={{color:'rgba(255,255,255,0.70)'}}>
                {text.split(highlight).map((part, i, arr) => (
                  i < arr.length - 1
                    ? <span key={i}>{part}<strong className="text-white">{highlight}</strong></span>
                    : <span key={i}>{part}</span>
                ))}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/signup"
          className="block w-full text-center font-bold py-4 rounded-xl text-base"
          style={{background:'linear-gradient(135deg,#00CCA3,#0078B8)',color:'#fff',boxShadow:'0 6px 24px rgba(0,120,184,0.35)'}}
        >
          Start Free at poolkeep.app →
        </Link>

        <p className="text-center text-xs pb-6" style={{color:'rgba(255,255,255,0.30)'}}>
          Free to start · No credit card · Upgrade anytime
        </p>
      </div>
    </div>
  )
}
