'use client'

import { useRouter } from 'next/navigation'

const LAST_UPDATED = 'May 21, 2025'

export default function PrivacyPage() {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-surface" style={{maxWidth:640,margin:'0 auto'}}>

      {/* Header */}
      <div className="bg-pool-deep px-5 pt-5 pb-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="text-white/60 hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span className="text-white text-base" style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:300}}>
            Pool<span style={{fontWeight:800}}>Keep</span>
          </span>
        </div>
        <h1 className="text-white text-2xl font-bold" style={{fontFamily:"'Oswald',sans-serif",letterSpacing:'-.01em'}}>Privacy Policy</h1>
        <p className="text-white/50 text-sm mt-1">Last updated {LAST_UPDATED}</p>
      </div>

      <div className="px-5 py-8 space-y-8 text-sm text-text-muted leading-relaxed">

        <p className="text-text-primary">
          PoolKeep is built to help you take care of your pool — not to profit from your data. This policy explains what we collect, why, and how it's protected.
        </p>

        <section>
          <h2 className="text-base font-bold text-text-primary mb-2">What we collect</h2>
          <ul className="space-y-2 list-disc list-inside">
            <li><strong>Account info</strong> — your email address, collected when you sign up.</li>
            <li><strong>Pool info</strong> — pool name, type, size, and zip code that you enter during setup.</li>
            <li><strong>Water test data</strong> — the readings you log (pH, chlorine, alkalinity, etc.) and the recommendations we generate from them.</li>
            <li><strong>Subscription status</strong> — whether you're on the free or Pro plan, managed through Stripe.</li>
          </ul>
          <p className="mt-3">We do <strong>not</strong> collect payment card numbers. All billing is handled by Stripe, who have their own privacy policy at stripe.com/privacy.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-text-primary mb-2">How we use it</h2>
          <ul className="space-y-2 list-disc list-inside">
            <li>To provide your pool health score and treatment recommendations.</li>
            <li>To store your test history so you can track your pool over time.</li>
            <li>To manage your subscription and send essential account emails.</li>
            <li>To improve the app — we may look at aggregate, anonymized usage patterns.</li>
          </ul>
          <p className="mt-3">We do <strong>not</strong> sell your data to anyone. Ever.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-text-primary mb-2">Third-party services</h2>
          <ul className="space-y-2 list-disc list-inside">
            <li><strong>Supabase</strong> — stores your account data and pool records securely in the US.</li>
            <li><strong>Stripe</strong> — processes subscription payments. We never see your card details.</li>
            <li><strong>Vercel</strong> — hosts the PoolKeep application.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-text-primary mb-2">Your rights</h2>
          <p>You can request a copy of your data, ask us to correct it, or delete your account at any time by emailing us. When you delete your account, your pool data and test history are permanently removed.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-text-primary mb-2">Data retention</h2>
          <p>We keep your data for as long as your account is active. If you cancel your Pro subscription, your data remains accessible on the free plan. If you delete your account, all data is removed within 30 days.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-text-primary mb-2">Cookies</h2>
          <p>We use only essential cookies required for authentication (keeping you logged in). We do not use advertising or tracking cookies.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-text-primary mb-2">Contact</h2>
          <p>Questions about this policy? Email us at <a href="mailto:hello@poolkeep.app" className="text-pool-dark underline">hello@poolkeep.app</a>.</p>
        </section>

      </div>
    </div>
  )
}
