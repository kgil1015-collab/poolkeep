'use client'

import { useRouter } from 'next/navigation'

const LAST_UPDATED = 'May 22, 2026'

export default function TermsPage() {
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
        <h1 className="text-white text-2xl font-bold" style={{fontFamily:"'Oswald',sans-serif",letterSpacing:'-.01em'}}>Terms of Service</h1>
        <p className="text-white/50 text-sm mt-1">Last updated {LAST_UPDATED}</p>
      </div>

      <div className="px-5 py-8 space-y-8 text-sm text-text-muted leading-relaxed">

        <p className="text-text-primary">
          By using PoolKeep you agree to these terms. They're written to be readable — not to trick you.
        </p>

        <section>
          <h2 className="text-base font-bold text-text-primary mb-2">What PoolKeep is</h2>
          <p>PoolKeep is a pool water management tool. You enter your water test readings and we provide a health score, treatment recommendations, and chemical dosing guidance based on your pool size.</p>
          <p className="mt-2"><strong>Important:</strong> PoolKeep provides general guidance based on standard pool chemistry principles. It is not a substitute for professional pool service advice. Always follow chemical manufacturer instructions and use appropriate safety equipment when handling pool chemicals.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-text-primary mb-2">Your account</h2>
          <ul className="space-y-2 list-disc list-inside">
            <li>You must provide a valid email address to create an account.</li>
            <li>You are responsible for keeping your account credentials secure.</li>
            <li>One account per person. You may not share accounts.</li>
            <li>You must be 18 or older to use PoolKeep.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-text-primary mb-2">Free and Pro plans</h2>
          <p><strong>Free plan</strong> includes 1 pool and access to your last 10 test results. Core features — logging, recommendations, and sharing — are always free and will remain so.</p>
          <p className="mt-2"><strong>Pro plan</strong> adds up to 5 pools, unlimited test history, and priority support. Pro is billed monthly or annually through Stripe. You can cancel at any time — your Pro access continues until the end of the billing period you've paid for.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-text-primary mb-2">Payments and refunds</h2>
          <p>Payments are processed by Stripe. By subscribing you authorize Stripe to charge your payment method on a recurring basis. Subscriptions renew automatically unless cancelled.</p>
          <p className="mt-2">We offer a full refund within 7 days of your first Pro charge if you're not satisfied. After 7 days, charges are non-refundable but you can cancel to stop future billing. To request a refund, email us at <a href="mailto:kgil1015@aol.com" className="text-pool-dark underline">kgil1015@aol.com</a>.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-text-primary mb-2">Your data</h2>
          <p>You own your pool data and test history. We don't sell it. See our <a href="/privacy" className="text-pool-dark underline">Privacy Policy</a> for full details on how we handle your data.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-text-primary mb-2">Acceptable use</h2>
          <p>You agree not to misuse PoolKeep — for example, by attempting to access other users' data, reverse-engineering the service, or using it for any unlawful purpose.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-text-primary mb-2">Disclaimer and limitation of liability</h2>
          <p>PoolKeep is provided "as is." We make no warranty that recommendations will be error-free or suitable for your specific situation. We are not liable for any damage to your pool, equipment, or health resulting from following our recommendations. Always use your judgment and consult a professional when in doubt.</p>
          <p className="mt-2">Our total liability to you for any claim is limited to the amount you paid us in the 12 months before the claim.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-text-primary mb-2">Changes to these terms</h2>
          <p>We may update these terms occasionally. If we make material changes, we'll notify you by email. Continued use of PoolKeep after changes means you accept the updated terms.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-text-primary mb-2">Contact</h2>
          <p>Questions? Email us at <a href="mailto:kgil1015@aol.com" className="text-pool-dark underline">kgil1015@aol.com</a>.</p>
        </section>

      </div>
    </div>
  )
}
