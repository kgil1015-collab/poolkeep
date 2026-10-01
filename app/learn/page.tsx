import type { Metadata } from 'next'
import Link from 'next/link'
import WaveDivider from '@/app/components/WaveDivider'
import { GUIDES } from './guides'
import { LearnNav, LearnCTA, LearnFooter } from './LearnChrome'

export const metadata: Metadata = {
  title: 'Learn Pool Care — Free Guides | PoolKeep',
  description: 'Free, plain-English guides to caring for your own pool: the basics, what each test reading means, a weekly routine, and fixing green or cloudy water.',
}

export default function LearnPage() {
  return (
    <div className="min-h-screen bg-white">
      <LearnNav />

      <section className="bg-pool-deep text-white text-center px-6 pt-16 pb-12">
        <p className="text-teal text-sm font-bold uppercase tracking-widest mb-4">Free Pool Care Guides</p>
        <h1 className="font-bold tracking-tight leading-tight mb-5" style={{fontFamily:"'Oswald',sans-serif",fontSize:'clamp(36px,6vw,60px)'}}>
          You can take care<br />of your own pool.
        </h1>
        <p className="text-white/75 text-lg max-w-xl mx-auto leading-relaxed">
          No jargon, no upsell. Just what pool owners actually need to know to keep the water clear, safe and inviting all season.
        </p>
      </section>

      <WaveDivider />

      <section className="bg-surface px-5 sm:px-6 pt-6 pb-16">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-5">
          {GUIDES.map((g, i) => (
            <Link
              key={g.slug}
              href={`/learn/${g.slug}`}
              className="group bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className="h-1.5" style={{background:g.accent}} />
              <div className="p-6 flex flex-col flex-1">
                <p className="text-xs font-bold uppercase tracking-widest text-text-faint mb-2">Guide {i + 1}</p>
                <h2 className="text-2xl font-bold text-text-primary mb-2" style={{fontFamily:"'Oswald',sans-serif"}}>{g.title}</h2>
                <p className="text-text-muted text-sm leading-relaxed flex-1">{g.summary}</p>
                <div className="flex items-center justify-between mt-5">
                  <span className="text-xs text-text-faint">{g.minutes} min read</span>
                  <span className="text-sm font-bold text-pool-dark group-hover:translate-x-0.5 transition-transform">Read guide →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <p className="max-w-4xl mx-auto text-center text-sm text-text-muted mt-10">
          New to pools? Start with <Link href="/learn/pool-basics" className="font-semibold text-pool-dark hover:underline">Pool Care Basics</Link> and work your way through.
        </p>
      </section>

      <LearnCTA />
      <LearnFooter />
    </div>
  )
}
