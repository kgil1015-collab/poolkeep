'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import WaveDivider from '@/app/components/WaveDivider'

type FAQItem = { q: string; a: string }
type FAQCategory = { title: string; items: FAQItem[] }

const CATEGORIES: FAQCategory[] = [
  {
    title: 'Chemical Storage & Safety',
    items: [
      {
        q: 'How far apart should I store muriatic acid and chlorine?',
        a: 'At least 3–4 feet apart, ideally on separate shelves or in separate cabinets, and never touching. If acid and chlorine (liquid or granular cal-hypo) mix — even from a leaking container — the reaction releases toxic chlorine gas. Store liquids below dry chemicals too, so a liquid leak can\'t drip onto a dry product and trigger a reaction.',
      },
      {
        q: "What's the right temperature to store pool chemicals at?",
        a: 'A cool, dry, ventilated spot below about 95°F, ideally 50–85°F. Avoid hot garages or attics in summer — heat speeds up chlorine degradation and raises pressure inside sealed containers.',
      },
      {
        q: 'How long does liquid chlorine last in storage?',
        a: "Not long — liquid chlorine (sodium hypochlorite, 10–12.5%) can lose meaningful strength within just a few weeks, faster in hot storage. Buy only what you'll use soon rather than stockpiling it.",
      },
      {
        q: 'How long does granular shock (cal-hypo) last?',
        a: "Much longer than liquid — properly sealed and kept dry, granular chlorine can last up to 5 years, and unopened chlorine tablets around 3 years. Moisture is the main enemy; keep the lid tight between uses.",
      },
      {
        q: 'Can I store muriatic acid and chlorine in the same shed?',
        a: "Yes, as long as they're physically separated — opposite walls or shelves, not stacked, not adjacent, with liquids stored below dry chemicals. A lockable, well-ventilated cabinet (metal slatted designs work well) keeps kids and pets out while still letting fumes escape.",
      },
      {
        q: 'What should I do if acid and chlorine accidentally mix?',
        a: 'Leave the area immediately and ventilate it — the chlorine gas this reaction produces is toxic. Do not attempt to clean up the spill while fumes are present. Wait for the area to air out fully before returning.',
      },
      {
        q: 'Should I add chemicals to water, or water to chemicals?',
        a: "Always add chemical to water, never water to chemical. Adding water to a concentrated chemical (especially acid) can cause a violent, splattering reaction. This applies whether you're pre-dissolving shock in a bucket or diluting acid.",
      },
    ],
  },
  {
    title: 'Dosing & Chemistry Basics',
    items: [
      {
        q: 'What order should I add pool chemicals in?',
        a: 'Alkalinity first (it stabilizes everything else), then pH, then chlorine or shock, then stabilizer (CYA), and calcium hardness last since it moves slowly. Adding them out of order means you end up chasing a moving target.',
      },
      {
        q: 'Why does my chlorine disappear so fast?',
        a: "Usually one of two things: low CYA (stabilizer) leaves chlorine unprotected from UV, which can burn it off in just a few hours of sun. Or high pH — at pH 7.8, only about a third of your chlorine is in its active, sanitizing form.",
      },
      {
        q: 'Liquid chlorine or granular shock (cal-hypo) — which should I use?',
        a: "Liquid chlorine works faster and adds zero calcium or CYA, which makes it the better choice if your calcium is already high or you need the pool ready same-day. Granular cal-hypo is cheaper and more available, but raises calcium hardness with every dose — worth watching in hard water areas.",
      },
      {
        q: 'How often should I test each parameter?',
        a: "Total alkalinity, pH, and chlorine are worth checking weekly since they shift fastest. Calcium hardness, CYA, and metals/phosphates move slowly and are fine to check monthly.",
      },
    ],
  },
  {
    title: 'Testing & Equipment',
    items: [
      {
        q: 'Test strips or a liquid test kit — does it matter?',
        a: "Either works fine for PoolKeep. Liquid drop kits (Taylor is the long-time industry standard) are more precise, especially for alkalinity, and are generally preferred for serious troubleshooting. Test strips (AquaChek is a common brand) are faster for routine weekly checks. Use whichever you'll actually do consistently.",
      },
      {
        q: 'How often should I clean my filter?',
        a: "Cartridge filters: hose off every 3–4 weeks. Sand filters: backwash every 1–2 weeks. DE filters: backwash monthly and fully break down/inspect the grids every 3 months. In all cases, the real signal is your pressure gauge — clean when it reads 8–10 PSI above the clean startup reading.",
      },
      {
        q: 'How long do pool filters actually last?',
        a: "Cartridges typically need replacing after 2–3 years of regular cleaning, sand media every 3–5 years, and DE grids as they develop rips or clog beyond restoration. Cleaning on schedule with the right chemical (not just water) extends all three.",
      },
    ],
  },
  {
    title: 'Algae & Cloudy Water',
    items: [
      {
        q: "My pool is cloudy — what's going on?",
        a: 'Cloudy water is almost always a chlorine or filtration issue — check free chlorine first. Low chlorine lets fine particles and organic matter build up. Running the filter longer and shocking the pool usually clears it within a day or two.',
      },
      {
        q: 'How do I get rid of green or algae-covered water?',
        a: "Brush all surfaces first — algae clings to walls and steps, and chlorine can't reach what it can't contact. Then shock the pool in the evening (chlorine breaks down fast in direct sun) and run the filter continuously until it clears.",
      },
      {
        q: 'Do I need to worry about phosphates?',
        a: "Phosphates alone don't cause algae or cloudiness — chlorine does that job regardless of phosphate level. A phosphate remover can help if you're fighting recurring algae despite good chlorine levels, but it's a secondary tool, not the first fix.",
      },
    ],
  },
  {
    title: 'Stains & Metals',
    items: [
      {
        q: 'How do I know if my stains are from metals?',
        a: "Metals discolor the water itself, not just surfaces: iron turns water brownish-red, copper turns it blue-green, and manganese turns it dark purple. A dedicated metals test (many pool stores offer this free) confirms it before you buy a treatment.",
      },
      {
        q: 'How do I prevent metal stains?',
        a: 'A sequestering agent added regularly binds dissolved metals so they stay suspended in the water instead of oxidizing onto surfaces — much easier than removing a stain after it forms. This matters most in well water or after using copper-based algaecides.',
      },
    ],
  },
  {
    title: 'Salt Pool Care',
    items: [
      {
        q: 'How often should I inspect my salt cell?',
        a: "Every 3 months. With water chemistry kept in range, most cells only need actual cleaning 1–3 times a year — inspecting doesn't mean cleaning every time, just checking for scale buildup on the plates.",
      },
      {
        q: 'How long does a salt cell last?',
        a: "Typically 3–7 years, depending on water balance, maintenance habits, and how hard the cell has to work for your pool size and target chlorine level. Keeping pH, calcium, and TA at the lower end of their ranges is the single biggest lever you have over cell lifespan.",
      },
      {
        q: 'What causes calcium buildup (scale) on my salt cell?',
        a: "High pH and hard water. Avoid cal-hypo shock in salt pools since it adds calcium directly — liquid chlorine is the better emergency option. Don't over-clean with acid either; stripping the cell's coating too often shortens its life just as much as scale does.",
      },
    ],
  },
  {
    title: 'Opening & Closing Your Pool',
    items: [
      {
        q: "What's the difference between closing and winterizing?",
        a: "Closing just means shutting things down and covering the pool — you could do this for a short trip. Winterizing goes further: draining water from lines and equipment so nothing freezes and cracks, plus adding chemicals to prevent algae over the off-season.",
      },
      {
        q: 'When should I close or open my pool?',
        a: "Close in early-to-mid fall once daytime highs consistently drop to around 65°F — cool enough that algae isn't racing you, warm enough to still work outside comfortably. Open again once temperatures are consistently hitting 65°F in spring, rather than waiting for full pool season.",
      },
      {
        q: 'What should I do right before closing for winter?',
        a: 'Vacuum and brush thoroughly, shock the pool and let it circulate 24 hours (re-shock if needed until chlorine holds 1–3 ppm), then make sure no water is left sitting in pumps, heaters, or filter lines before shutting everything down.',
      },
    ],
  },
  {
    title: 'Using PoolKeep',
    items: [
      {
        q: 'How do I fix a test I just logged wrong?',
        a: "Tap any value tile in the Water Report on your dashboard. You can edit your most recent test up to 3 times, within 12 hours of logging it — after that, log a fresh test instead. This is meant for catching a misread strip, not rewriting your history.",
      },
      {
        q: "What's included in the free plan?",
        a: '5 free water tests, no credit card required. Pro unlocks unlimited tests, full history, and up to 5 pools.',
      },
      {
        q: 'Does PoolKeep work differently for salt pools?',
        a: 'Yes — salt pools get tighter target ranges for CYA, alkalinity, and calcium, since a salt cell is more sensitive to scale and stabilizer levels. Set your pool type in setup and recommendations adjust automatically.',
      },
    ],
  },
]

type Product = { name: string; note: string; searchTerm: string }
type ProductCategory = { title: string; items: Product[] }

const PRODUCT_CATEGORIES: ProductCategory[] = [
  {
    title: 'Water Testing',
    items: [
      { name: 'Taylor K-2006 Complete Test Kit', note: 'Liquid drop kit — the industry-standard choice pool pros reach for when accuracy matters most.', searchTerm: 'Taylor K-2006 pool test kit' },
      { name: 'AquaChek 7-in-1 Test Strips', note: 'Fast weekly checks across all core parameters in one dip.', searchTerm: 'AquaChek 7-in-1 test strips' },
    ],
  },
  {
    title: 'Chlorine & Shock',
    items: [
      { name: 'Liquid Chlorine (10–12.5% Sodium Hypochlorite)', note: 'Fast-acting, adds zero calcium or CYA — the go-to for salt pools and hard-water areas.', searchTerm: 'liquid pool chlorine 10 percent sodium hypochlorite' },
      { name: 'Cal-Hypo Granular Shock (65%)', note: 'Affordable and widely available for standard chlorine pools; watch calcium buildup with repeated use.', searchTerm: 'cal hypo pool shock 65 percent' },
    ],
  },
  {
    title: 'pH & Alkalinity',
    items: [
      { name: 'Muriatic Acid (31.45%)', note: 'Standard, inexpensive pH and alkalinity reducer.', searchTerm: 'muriatic acid pool 31.45 percent' },
      { name: 'Dry Acid (Sodium Bisulfate)', note: 'No fumes, easier to handle than liquid acid — a good option if storage safety is a concern.', searchTerm: 'dry acid sodium bisulfate pool pH down' },
      { name: 'Alkalinity Increaser (Sodium Bicarbonate)', note: "Identical to grocery-store baking soda — the pool-store version just costs more.", searchTerm: 'pool alkalinity increaser sodium bicarbonate' },
    ],
  },
  {
    title: 'Scale & Metal Control',
    items: [
      { name: "Jack's Magic The Blue Stuff", note: 'Sequestering agent that keeps calcium in solution before it can scale surfaces or a salt cell.', searchTerm: "Jack's Magic Blue Stuff pool" },
      { name: 'SeaKlear Metal Klear', note: 'Fast-acting metal and scale sequestrant, popular for well water and closing season.', searchTerm: 'SeaKlear Metal Klear' },
    ],
  },
  {
    title: 'Algae Control',
    items: [
      { name: 'HTH Algae Guard Ultra', note: 'Strong non-foaming algaecide for stubborn green, black, or mustard algae.', searchTerm: 'HTH Algae Guard Ultra' },
      { name: 'Clorox Pool&Spa Algaecide + Clarifier', note: 'Combines copper-based algae control with a water clarifier in one product.', searchTerm: 'Clorox Pool Spa Algaecide Clarifier' },
    ],
  },
  {
    title: 'Storage & Safety',
    items: [
      { name: 'Keter XXL Outdoor Storage Cabinet', note: 'Ventilated and lockable — built to keep chemicals separated, dry, and out of reach of kids.', searchTerm: 'Keter XXL outdoor storage cabinet' },
      { name: 'Suncast Deck Box (77 Gallon)', note: 'Weather-resistant alternative if you need extra outdoor storage capacity.', searchTerm: 'Suncast 77 gallon deck box' },
    ],
  },
]

function amazonSearchUrl(term: string) {
  return `https://www.amazon.com/s?k=${encodeURIComponent(term)}`
}

export default function FAQPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'faq' | 'products'>('faq')
  const [query, setQuery] = useState('')
  const [openKey, setOpenKey] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setLoading(false)
    })
  }, [router])

  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return CATEGORIES
    return CATEGORIES
      .map(cat => ({
        ...cat,
        items: cat.items.filter(item => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)),
      }))
      .filter(cat => cat.items.length > 0)
  }, [query])

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col" style={{maxWidth:480,margin:'0 auto'}}>
        <div className="bg-pool-deep px-5 pt-5 pb-6 animate-pulse">
          <div className="h-5 w-24 rounded-full bg-white/15 mb-6" />
          <div className="h-7 w-40 rounded-full bg-white/20" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col" style={{maxWidth:480,margin:'0 auto'}}>

      {/* Header */}
      <div className="bg-pool-deep px-5 pt-5 pb-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/dashboard')} className="text-white/60 hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button onClick={() => router.push('/dashboard')} className="text-white text-base hover:opacity-75 transition-opacity" style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:300}}>
            Pool<span style={{fontWeight:800}}>Keep</span>
          </button>
        </div>
        <h1 className="text-white text-2xl font-bold" style={{fontFamily:"'Oswald',sans-serif",letterSpacing:'-.01em'}}>Help &amp; FAQ</h1>
        <p className="text-white/55 text-sm mt-1">Pool care answers, storage safety, and app basics</p>
      </div>

      <WaveDivider />

      {/* Tab switcher */}
      <div className="bg-surface px-4 pt-3 pb-1 flex gap-2">
        <button
          onClick={() => setTab('faq')}
          className="flex-1 py-2 text-xs font-bold rounded-xl transition-all"
          style={tab === 'faq' ? {background:'#003D5C',color:'white'} : {background:'#F0F6FA',color:'#8AAABB'}}
        >
          FAQ
        </button>
        <button
          onClick={() => setTab('products')}
          className="flex-1 py-2 text-xs font-bold rounded-xl transition-all"
          style={tab === 'products' ? {background:'#003D5C',color:'white'} : {background:'#F0F6FA',color:'#8AAABB'}}
        >
          Preferred Products
        </button>
      </div>

      {/* FAQ tab */}
      {tab === 'faq' && (
        <div className="flex-1 px-4 pt-3 pb-24 bg-surface">
          {/* Search */}
          <div className="relative mb-4">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8AAABB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)'}}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search the FAQ — try &quot;chlorine&quot; or &quot;storage&quot;"
              className="w-full bg-white rounded-xl py-3 pl-10 pr-4 text-sm outline-none border border-gray-100 shadow-sm placeholder:text-text-faint"
              style={{color:'#0D2333'}}
            />
          </div>

          {filteredCategories.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center mt-2">
              <p className="text-text-primary font-semibold mb-1">No results</p>
              <p className="text-text-muted text-sm">Try a different search term.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {filteredCategories.map(cat => (
                <div key={cat.title}>
                  <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2">{cat.title}</p>
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {cat.items.map((item, i) => {
                      const key = `${cat.title}-${item.q}`
                      const isOpen = openKey === key || query.trim() !== ''
                      return (
                        <div key={key} className={i > 0 ? 'border-t border-gray-100' : ''}>
                          <button
                            className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                            onClick={() => setOpenKey(isOpen && query.trim() === '' ? null : key)}
                          >
                            <span className="flex-1 text-sm font-semibold text-text-primary">{item.q}</span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8AAABB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                              style={{transform: isOpen ? 'rotate(180deg)' : 'none', transition:'transform .2s', flexShrink:0}}>
                              <polyline points="6 9 12 15 18 9"/>
                            </svg>
                          </button>
                          {isOpen && (
                            <div className="px-4 pb-3.5 -mt-0.5">
                              <p className="text-[13px] text-text-muted leading-relaxed">{item.a}</p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Products tab */}
      {tab === 'products' && (
        <div className="flex-1 px-4 pt-3 pb-24 bg-surface">
          <p className="text-[11px] text-text-muted leading-relaxed mb-4">
            Commonly recommended by pool professionals and retailers — not personally tested by PoolKeep. Links open an Amazon search so you can compare sellers and prices yourself.
          </p>
          <div className="space-y-5">
            {PRODUCT_CATEGORIES.map(cat => (
              <div key={cat.title}>
                <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2">{cat.title}</p>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  {cat.items.map((p, i) => (
                    <a
                      key={p.name}
                      href={amazonSearchUrl(p.searchTerm)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-3 px-4 py-3.5 hover:bg-surface transition-colors ${i > 0 ? 'border-t border-gray-100' : ''}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text-primary">{p.name}</p>
                        <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">{p.note}</p>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0078B8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-2">
        <div className="flex items-center justify-around py-2 max-w-md mx-auto">
          {[
            { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
            { id: 'history', label: 'History', path: '/history', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="12 8 12 12 14 14"/><path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"/></svg> },
            { id: 'log', label: '', path: '/log', icon: null },
            { id: 'share', label: 'Share', path: '/share', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> },
            { id: 'pro', label: 'Account', path: '/pro', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
          ].map(tabItem => {
            if (tabItem.id === 'log') return (
              <button key="log" onClick={() => router.push('/log')} className="w-14 h-14 rounded-full bg-pool-dark flex items-center justify-center shadow-lg -mt-5 border-4 border-white">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            )
            return (
              <button key={tabItem.id} onClick={() => router.push(tabItem.path)} className="flex flex-col items-center gap-1 px-3 py-1 min-w-0">
                <span style={{color: '#8AAABB'}}>{tabItem.icon}</span>
                <span className="text-[10px] font-medium" style={{color: '#8AAABB'}}>{tabItem.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
