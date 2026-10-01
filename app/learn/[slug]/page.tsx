import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import WaveDivider from '@/app/components/WaveDivider'
import { GUIDES, getGuide, type Block } from '../guides'
import { LearnNav, LearnCTA, LearnFooter } from '../LearnChrome'

type Params = Promise<{ slug: string }>

export const dynamicParams = false

export function generateStaticParams() {
  return GUIDES.map(g => ({ slug: g.slug }))
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const guide = getGuide((await params).slug)
  if (!guide) return {}
  return {
    title: `${guide.title} | PoolKeep Learn`,
    description: guide.summary,
  }
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case 'p':
      return <p className="text-text-muted leading-relaxed">{block.text}</p>

    case 'h':
      return <h2 className="text-2xl font-bold text-text-primary pt-4" style={{fontFamily:"'Oswald',sans-serif"}}>{block.text}</h2>

    case 'list':
      return (
        <ul className="space-y-2.5">
          {block.items.map(item => (
            <li key={item} className="flex gap-3 text-text-muted leading-relaxed">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-pool-blue flex-shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )

    case 'steps':
      return (
        <ol className="space-y-4">
          {block.items.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <span className="w-9 h-9 rounded-full bg-pool-dark text-white text-sm font-extrabold flex items-center justify-center flex-shrink-0">{i + 1}</span>
              <div className="pt-1">
                <p className="font-bold text-text-primary mb-1">{s.title}</p>
                <p className="text-text-muted leading-relaxed text-[15px]">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      )

    case 'tip':
      return (
        <div className="rounded-2xl p-5 border" style={{background:'rgba(0,224,176,0.08)',borderColor:'rgba(0,224,176,0.35)'}}>
          <p className="text-xs font-bold uppercase tracking-widest mb-1.5" style={{color:'#00866A'}}>{block.title}</p>
          <p className="text-text-primary leading-relaxed text-[15px]">{block.text}</p>
        </div>
      )

    case 'warn':
      return (
        <div className="rounded-2xl p-5 border" style={{background:'rgba(245,166,35,0.08)',borderColor:'rgba(245,166,35,0.4)'}}>
          <p className="text-xs font-bold uppercase tracking-widest mb-1.5" style={{color:'#B26F00'}}>⚠ {block.title}</p>
          <p className="text-text-primary leading-relaxed text-[15px]">{block.text}</p>
        </div>
      )

    case 'readings':
      return (
        <div className="space-y-4">
          {block.items.map(r => (
            <div key={r.name} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-pool-deep px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-white text-xl font-bold" style={{fontFamily:"'Oswald',sans-serif"}}>{r.name}</p>
                  {r.short !== r.name && <p className="text-white/50 text-xs font-mono">{r.short}</p>}
                </div>
                <div className="text-right">
                  <p className="text-teal font-bold font-mono text-sm">{r.ideal}</p>
                  {r.saltIdeal && <p className="text-white/55 font-mono text-xs">Salt pools: {r.saltIdeal}</p>}
                </div>
              </div>
              <div className="p-5 space-y-3 text-[15px] leading-relaxed">
                <p className="text-text-primary">{r.what}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl bg-surface p-3.5">
                    <p className="text-xs font-bold uppercase tracking-widest text-pool-dark mb-1">Too low</p>
                    <p className="text-text-muted text-sm">{r.low}</p>
                  </div>
                  <div className="rounded-xl bg-surface p-3.5">
                    <p className="text-xs font-bold uppercase tracking-widest text-danger mb-1">Too high</p>
                    <p className="text-text-muted text-sm">{r.high}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )

    case 'checklist':
      return (
        <div className="space-y-5">
          {block.groups.map(g => (
            <div key={g.title} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <p className="text-xl font-bold text-text-primary mb-3" style={{fontFamily:"'Oswald',sans-serif"}}>{g.title}</p>
              <ul className="space-y-2.5">
                {g.items.map(item => (
                  <li key={item} className="flex gap-3 text-text-muted leading-relaxed text-[15px]">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1DB869" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )
  }
}

export default async function GuidePage({ params }: { params: Params }) {
  const { slug } = await params
  const guide = getGuide(slug)
  if (!guide) notFound()

  const index = GUIDES.findIndex(g => g.slug === slug)
  const prev = GUIDES[index - 1]
  const next = GUIDES[index + 1]

  return (
    <div className="min-h-screen bg-white">
      <LearnNav />

      <header className="bg-pool-deep text-white px-6 pt-10 pb-8">
        <div className="max-w-2xl mx-auto">
          <Link href="/learn" className="text-white/60 text-sm hover:text-white transition-colors">← All guides</Link>
          <p className="text-teal text-xs font-bold uppercase tracking-widest mt-6 mb-2">Guide {index + 1} of {GUIDES.length} · {guide.minutes} min read</p>
          <h1 className="font-bold tracking-tight leading-tight mb-3" style={{fontFamily:"'Oswald',sans-serif",fontSize:'clamp(32px,5vw,48px)'}}>{guide.title}</h1>
          <p className="text-white/70 text-lg leading-relaxed">{guide.summary}</p>
        </div>
      </header>

      <WaveDivider />

      <article className="bg-surface px-5 sm:px-6 pt-4 pb-16">
        <div className="max-w-2xl mx-auto space-y-5">
          {guide.blocks.map((block, i) => <BlockView key={i} block={block} />)}
        </div>

        <div className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3 mt-12">
          {prev ? (
            <Link href={`/learn/${prev.slug}`} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
              <p className="text-xs text-text-faint mb-1">← Previous</p>
              <p className="font-bold text-text-primary">{prev.title}</p>
            </Link>
          ) : <div className="hidden sm:block" />}
          {next && (
            <Link href={`/learn/${next.slug}`} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-right hover:shadow-md transition-shadow">
              <p className="text-xs text-text-faint mb-1">Next →</p>
              <p className="font-bold text-text-primary">{next.title}</p>
            </Link>
          )}
        </div>
      </article>

      <LearnCTA />
      <LearnFooter />
    </div>
  )
}
