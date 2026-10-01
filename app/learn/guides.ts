// Free, public pool-care guides shown under /learn.
// Ranges and advice mirror lib/recommendations.ts and the FAQ so the guides
// never contradict what the app tells someone after they log a test.

export type Block =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'steps'; items: { title: string; text: string }[] }
  | { type: 'tip'; title: string; text: string }
  | { type: 'warn'; title: string; text: string }
  | { type: 'readings'; items: Reading[] }
  | { type: 'checklist'; groups: { title: string; items: string[] }[] }

export type Reading = {
  name: string
  short: string
  ideal: string
  saltIdeal?: string
  what: string
  low: string
  high: string
}

export type Guide = {
  slug: string
  title: string
  summary: string
  minutes: number
  accent: string
  blocks: Block[]
}

export const GUIDES: Guide[] = [
  {
    slug: 'pool-basics',
    title: 'Pool Care Basics',
    summary: 'The three things every pool needs, the short list of supplies to keep on hand, and how to handle chemicals safely.',
    minutes: 5,
    accent: '#00A8F0',
    blocks: [
      { type: 'p', text: "Taking care of your own pool is far simpler than the pool store aisle makes it look. Almost everything comes down to three habits: keep the water moving, keep it clean, and keep it balanced. Get those right and clear water mostly takes care of itself." },
      { type: 'h', text: 'The three pillars' },
      {
        type: 'steps',
        items: [
          { title: 'Circulation', text: "Your pump and filter are the heart of the pool. Water that isn't moving through the filter collects debris and gives algae a place to settle. Most pools need the pump running around 8–12 hours a day in swim season, longer in hot weather or after a heavy storm." },
          { title: 'Cleaning', text: "Skim floating debris, empty the skimmer and pump baskets, brush the walls and steps, and vacuum the floor. Brushing matters more than people expect: algae clings to surfaces, and chlorine can't reach what it can't contact." },
          { title: 'Chemistry', text: 'Chlorine keeps the water sanitary, and pH, alkalinity, stabilizer and calcium keep that chlorine working and protect your surfaces and equipment. Test regularly and make small adjustments rather than big rescues.' },
        ],
      },
      { type: 'h', text: 'What to keep on hand' },
      {
        type: 'list',
        items: [
          'A test kit or test strips. Liquid drop kits (like the Taylor K-2006) are more precise; strips are faster. Use whichever you will actually do every week.',
          'Chlorine: liquid chlorine (10–12.5% sodium hypochlorite) or granular cal-hypo shock. Liquid works faster and adds no calcium or stabilizer.',
          'Muriatic acid or dry acid to bring pH and alkalinity down.',
          'Alkalinity increaser, which is the same thing as grocery-store baking soda.',
          'A wall brush, a leaf skimmer net and a vacuum head.',
          'Gloves and eye protection for handling acid and chlorine.',
        ],
      },
      { type: 'h', text: 'Add chemicals in the right order' },
      { type: 'p', text: "Alkalinity first, because it stabilizes everything else. Then pH, then chlorine or shock, then stabilizer (CYA), and calcium hardness last since it moves slowly. Adding them out of order means you end up chasing a moving target." },
      { type: 'h', text: 'Chemical safety' },
      {
        type: 'warn',
        title: 'Never let acid and chlorine mix',
        text: 'Store muriatic acid and chlorine at least 3–4 feet apart, ideally on separate shelves, and never touching. If they mix, even from a leaking container, the reaction releases toxic chlorine gas. If it happens, leave the area, let it air out completely and do not try to clean up while fumes are present.',
      },
      {
        type: 'list',
        items: [
          'Always add chemical to water, never water to chemical. This applies to pre-dissolving shock in a bucket and diluting acid.',
          'Store liquids below dry chemicals so a leak cannot drip onto a dry product.',
          'Keep everything in a cool, dry, ventilated spot below about 95°F, out of reach of kids and pets.',
          'Buy liquid chlorine as you need it. It can lose meaningful strength within a few weeks, faster in a hot garage.',
        ],
      },
      { type: 'tip', title: 'Next step', text: 'Once you know the basics, learn what each test reading actually tells you. That is what turns guessing into a plan.' },
    ],
  },
  {
    slug: 'understanding-readings',
    title: 'What Each Reading Means',
    summary: 'Free chlorine, pH, alkalinity, stabilizer, calcium and salt: the ideal range for each, and what happens when it drifts.',
    minutes: 7,
    accent: '#00E0B0',
    blocks: [
      { type: 'p', text: "A test kit hands you a row of numbers. Each one tells you something different about your water, and they affect each other. Here is what every reading means, where it should sit and what to do when it doesn't." },
      {
        type: 'readings',
        items: [
          {
            name: 'Free Chlorine',
            short: 'FC',
            ideal: '1–3 ppm',
            what: 'The sanitizer that is actively available to kill bacteria and algae. This is the reading that keeps swimmers safe.',
            low: 'Below 1 ppm the water is no longer reliably sanitized and algae can take hold within days. Add chlorine in the evening, since sunlight burns it off fast.',
            high: 'Right after shocking, high chlorine is expected. Wait until it tests below 5 ppm before swimming.',
          },
          {
            name: 'pH',
            short: 'pH',
            ideal: '7.2–7.6',
            what: "How acidic or basic the water is. pH controls how much of your chlorine is actually working: about 73% is active at pH 7.0, 49% at 7.5 and only 33% at 7.8.",
            low: 'Low pH stings eyes and slowly etches plaster, grout and metal fittings. Raise it with soda ash, a little at a time.',
            high: 'High pH wastes chlorine and encourages scale and cloudy water. Lower it with muriatic acid or dry acid added to the deep end with the pump running.',
          },
          {
            name: 'Total Alkalinity',
            short: 'TA',
            ideal: '80–120 ppm',
            saltIdeal: '80–100 ppm',
            what: "Your pool's pH shock absorber. When TA is in range, rain, swimmers and chemical additions barely move pH.",
            low: 'pH swings wildly and adjustments never hold. Fix TA first with alkalinity increaser (baking soda), split into two doses a few hours apart.',
            high: 'pH becomes stubborn and keeps drifting up. Bring it down slowly with small acid doses plus aeration, repeated over a few weeks. Strips can read TA 30–60 ppm high, so confirm with a drop test first.',
          },
          {
            name: 'Stabilizer',
            short: 'CYA',
            ideal: '30–50 ppm',
            saltIdeal: '70–80 ppm',
            what: 'Cyanuric acid shields chlorine from sunlight. Without it, UV can destroy most of your chlorine within a couple of hours on a clear day.',
            low: 'Chlorine disappears almost as fast as you add it. Add stabilizer through the skimmer or in a mesh bag in front of a return jet.',
            high: 'Above about 100 ppm it starts holding chlorine back from doing its job. The only real fix is a partial drain and refill, so confirm with a drop test first since strips often read high.',
          },
          {
            name: 'Calcium Hardness',
            short: 'CH',
            ideal: '200–400 ppm',
            saltIdeal: '200–350 ppm',
            what: 'The amount of dissolved calcium in the water. It moves slowly, so it only needs checking about once a month.',
            low: 'Water that is too soft pulls calcium out of plaster and grout, etching surfaces. Raise it with calcium chloride.',
            high: 'Excess calcium, especially with high pH, comes out of the water as chalky scale on tile, plaster and salt cells. Keep pH at the low end and use a sequestering agent.',
          },
          {
            name: 'Salt',
            short: 'Salt',
            ideal: '2,700–3,400 ppm',
            what: 'Only for saltwater pools. Your salt cell turns this salt into chlorine. Check your generator manual for its exact range.',
            low: 'The cell makes less chlorine and may shut off. Add pool salt and let it dissolve before retesting.',
            high: 'Usually harmless in small amounts, but it can trigger cell warnings and taste salty. Dilute with fresh water if it is well over range.',
          },
        ],
      },
      { type: 'h', text: 'How often to test' },
      { type: 'p', text: 'Free chlorine, pH and alkalinity shift the fastest, so test them at least once a week. Calcium hardness, stabilizer and metals move slowly and are fine to check monthly.' },
      { type: 'tip', title: 'Salt pools run a little different', text: 'Salt pools aim for tighter alkalinity and calcium and more stabilizer, because the salt cell is sensitive to scale and needs extra UV protection for the chlorine it makes. The ranges marked "salt" above are the ones to follow.' },
    ],
  },
  {
    slug: 'weekly-routine',
    title: 'Your Weekly Routine',
    summary: 'A simple checklist that keeps the water clear in about 30 minutes a week, plus the monthly and seasonal jobs.',
    minutes: 4,
    accent: '#0078B8',
    blocks: [
      { type: 'p', text: "Consistency beats intensity. A short routine done every week prevents almost every green, cloudy or scaly pool you'll ever see. Pick a day, grab a drink and work through this list." },
      {
        type: 'checklist',
        groups: [
          {
            title: 'Every week',
            items: [
              'Skim the surface and empty the skimmer and pump baskets.',
              'Brush the walls, steps and corners, then vacuum the floor.',
              'Test free chlorine, pH and alkalinity.',
              'Adjust in order: alkalinity, then pH, then chlorine.',
              'Add chlorine in the evening so the sun does not burn it off.',
              'Check the filter pressure gauge and note the reading.',
              'Top up the water level so it sits around the middle of the skimmer opening.',
            ],
          },
          {
            title: 'Every month',
            items: [
              'Test stabilizer (CYA) and calcium hardness.',
              'Clean a cartridge filter every 3–4 weeks, or backwash a sand filter every 1–2 weeks.',
              'Backwash a DE filter monthly, and break down and inspect the grids every 3 months.',
              'Salt pools: check the salt level and inspect the cell every 3 months.',
            ],
          },
          {
            title: 'Each season',
            items: [
              'Open in spring once temperatures consistently reach about 65°F.',
              'Close in early-to-mid fall once daytime highs settle around 65°F.',
              'Before closing, vacuum and brush, shock, and let it circulate until chlorine holds 1–3 ppm.',
            ],
          },
        ],
      },
      {
        type: 'tip',
        title: 'Let the pressure gauge tell you when to clean',
        text: 'Write down the filter pressure right after a cleaning. When it reads 8–10 PSI above that number, it is time to clean or backwash, whatever the calendar says.',
      },
      { type: 'h', text: 'After a heavy storm or a pool party' },
      { type: 'p', text: 'Rain dilutes chemicals and washes in debris, and a lot of swimmers use up chlorine quickly. Skim, run the pump longer, and test the next day instead of waiting for your usual day.' },
    ],
  },
  {
    slug: 'green-or-cloudy-water',
    title: 'Fixing Green or Cloudy Water',
    summary: 'How to tell what went wrong and the step-by-step plan to get your water clear again.',
    minutes: 6,
    accent: '#1DB869',
    blocks: [
      { type: 'p', text: "It happens to everyone. A hot week, a missed test or a big storm, and suddenly the water is hazy or tinted green. The good news: both problems have the same root cause and the same fix. Not enough active chlorine for long enough." },
      { type: 'h', text: 'First, figure out what you are looking at' },
      {
        type: 'list',
        items: [
          'Cloudy or hazy: almost always low chlorine or poor filtration letting fine particles and organic matter build up.',
          'Green, especially with slimy walls: algae. It grows fast once chlorine drops near zero.',
          'Clear but tinted blue-green, brown or purple: probably dissolved metals, not algae. Copper turns water blue-green, iron brownish-red and manganese dark purple. Get a metals test before buying treatments.',
        ],
      },
      { type: 'h', text: 'The step-by-step fix' },
      {
        type: 'steps',
        items: [
          { title: 'Test the water', text: 'Check free chlorine, pH, alkalinity and stabilizer. You need these numbers to pick the right dose.' },
          { title: 'Get pH into range first', text: 'At pH 7.8 only about a third of your chlorine is working. Bringing pH down to 7.2–7.4 means far more of the chlorine you add will actually kill algae.' },
          { title: 'Brush everything', text: 'Brush the walls, floor, steps and corners. This knocks algae off surfaces and into the water, where chlorine can reach it.' },
          { title: 'Shock in the evening', text: 'Add a large chlorine dose after sunset so UV does not destroy it before it works. Liquid chlorine acts within minutes and adds no calcium or stabilizer.' },
          { title: 'Run the filter around the clock', text: 'Keep the pump on continuously until the water clears. Clean or backwash the filter when the pressure climbs, since it will be catching a lot of dead algae.' },
          { title: 'Retest and repeat', text: 'Test again the next morning. If chlorine has dropped a lot overnight, the algae is still using it up. Re-shock and keep brushing daily until chlorine holds steady overnight and the water is clear.' },
        ],
      },
      {
        type: 'tip',
        title: 'How much chlorine is enough?',
        text: 'Your stabilizer level decides it. A common rule of thumb is to hold free chlorine at about 40% of your CYA reading until the pool clears: roughly 12 ppm at 30 CYA, or 20 ppm at 50 CYA. Low stabilizer is also the most common reason chlorine vanishes overnight.',
      },
      {
        type: 'warn',
        title: 'Stay out until it is safe',
        text: 'Do not swim until free chlorine tests below 5 ppm and you can clearly see the bottom of the deep end. Always test before getting in rather than guessing by time.',
      },
      { type: 'h', text: 'What about phosphates and algaecide?' },
      { type: 'p', text: "Phosphates don't cause algae on their own. Enough chlorine kills algae regardless of phosphate level. A phosphate remover or algaecide can help if algae keeps coming back despite good chlorine, but they are secondary tools, not the first fix." },
      { type: 'h', text: 'Keeping it from coming back' },
      { type: 'p', text: 'Keep chlorine at 1–3 ppm, keep stabilizer in range so chlorine survives the sun, brush weekly and run the pump long enough each day. The weekly routine is your best insurance.' },
    ],
  },
]

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find(g => g.slug === slug)
}
