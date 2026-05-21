export type TestInput = {
  ph: number | null
  free_chlorine: number | null
  total_alkalinity: number | null
  cya: number | null
  calcium_hardness: number | null
  salt: number | null
}

export type Rec = {
  status: 'action' | 'monitor' | 'good' | 'unknown'
  param: string
  title: string
  desc: string
  tags: string[]
}

export type TreatmentStep = {
  step: number
  urgency: 'urgent' | 'soon' | 'routine'
  param: string
  title: string
  chemical: string | null
  amount: string | null
  why: string
  how: string
  lookFor: string
  note?: string
}

export type RecommendationResult = {
  health_score: number
  treatment_plan: TreatmentStep[]
  unknown: Rec[]
  action: Rec[]
  monitor: Rec[]
  good: Rec[]
}

function oz(amount: number, unit: string) {
  if (unit === 'oz' && amount >= 128) return `${(amount / 128).toFixed(1)} gal`
  if (unit === 'oz' && amount >= 16) return `${(amount / 16).toFixed(1)} lbs`
  if (unit === 'lbs' && amount < 1) return `${Math.round(amount * 16)} oz`
  return `${amount % 1 === 0 ? amount : amount.toFixed(1)} ${unit}`
}

// Correct chemical order for balancing pool water:
//   0 — shock (critically unsafe chlorine — safety first, overrides sequence)
//   1 — total alkalinity (foundation; pH adjustments won't hold until TA is stable)
//   2 — pH (once TA is stable, pH adjustments hold)
//   3 — chlorine maintenance (low but not critical; most effective at correct pH)
//   4 — CYA / stabilizer (protect the chlorine you just established)
//   5 — calcium hardness (slow-moving; adjust last)
function buildTreatmentPlan(test: TestInput, v: number): TreatmentStep[] {
  const raw: Array<{ order: number } & Omit<TreatmentStep, 'step'>> = []

  const ph = test.ph
  const fc = test.free_chlorine
  const ta = test.total_alkalinity
  const cya = test.cya
  const ca = test.calcium_hardness

  // ── SHOCK (critically low chlorine — acid first, then shock) ────────────────
  if (fc !== null && fc < 0.5) {
    const dose = Math.round(v * 2 * Math.max(1, 3 - fc))
    const phHigh = ph !== null && ph > 7.2
    const phUnknown = ph === null
    const acidDose = ph !== null && ph > 7.2
      ? Math.round(v * 13 * ((ph - 7.2) / 0.6))
      : Math.round(v * 8)
    const needsAcid = phHigh || phUnknown
    const phEfficiency = ph !== null
      ? ph <= 7.0 ? '73%' : ph <= 7.2 ? '66%' : ph <= 7.5 ? '49%' : ph <= 7.8 ? '33%' : '21%'
      : null
    raw.push({
      order: 0,
      urgency: 'urgent',
      param: 'chlorine',
      title: needsAcid ? 'Lower pH first, then shock' : 'Shock the pool — do not swim yet',
      chemical: needsAcid ? 'pH Reducer (Muriatic Acid) → then Pool Shock' : 'Pool Shock',
      amount: needsAcid
        ? `${oz(acidDose, 'oz')} acid · then ${oz(dose, 'lbs')} shock`
        : oz(dose, 'lbs'),
      why: `Free chlorine is at ${fc} ppm — water is unsafe to swim in. Here is something most pool owners never learn: the effectiveness of chlorine is almost entirely controlled by pH. Chlorine exists in two forms in water — active (hypochlorous acid, HOCl) and inactive (hypochlorite ion, OCl⁻). Only the active form kills bacteria and algae. At pH 7.0, about 73% of your chlorine is in that active form. At pH 7.5, it drops to 49%. At pH 7.8, only 33%. At pH 8.0, just 21%. ${phHigh && phEfficiency ? `Your current pH of ${ph} means only about ${phEfficiency} of the shock you add will actually be working. Lowering pH first before shocking means 2–3× more active sanitizer from the same amount of product.` : phUnknown ? `Since pH is untested, add a small acid dose first as a precaution — if your pH is elevated you could waste the majority of the shock you add.` : `With pH already in range, a high percentage of the shock you add will be in its active, sanitizing form.`}`,
      how: `${needsAcid
        ? `Step 1 — Add muriatic acid (${oz(acidDose, 'oz')}) to the deep end with the pump running. Wear gloves and eye protection. Wait 30–60 minutes for it to fully circulate through the pool.\n\nStep 2 — `
        : ``}Add shock in the evening — UV sunlight destroys chlorine rapidly, and shocking during the day means much of it is gone before it can do its job. Pour around the deep end with the pump running.\n\nChoosing your shock product: Liquid chlorine starts working within minutes and is best when you need same-day results — it also does not add CYA or raise calcium. Granular shock (cal-hypo) takes longer to fully dissolve and activate, but stays in the water longer and is better for an overnight recovery treatment. Both are effective. Avoid dichlor shock if your CYA is already in the upper part of its range, since dichlor adds CYA with every single dose and can push you toward chlorine lock over time.`,
      lookFor: `Retest in 2 hours and again the next morning. Do not swim until chlorine reads above 1 ppm. Chlorine will spike well above normal levels before settling — that is expected and is not a problem. If levels drop back near zero within a day or two, check your CYA. Without adequate stabilizer (30–50 ppm), UV sunlight can destroy most of your chlorine within a few hours on a sunny day — no amount of shocking will hold if the stabilizer is not protecting it.`,
      note: phUnknown
        ? `Test pH before adding acid if possible. If pH is already at or below 7.2, skip the acid step and go straight to shocking.`
        : undefined,
    })
  }

  // ── TOTAL ALKALINITY (must be stable before pH adjustment will hold) ────────
  if (ta !== null) {
    if (ta < 60) {
      const dose = ((80 - ta) / 10) * 1.5 * v
      raw.push({
        order: 1,
        urgency: 'soon',
        param: 'alkalinity',
        title: 'Raise total alkalinity first',
        chemical: 'Baking Soda',
        amount: oz(dose, 'lbs'),
        why: `Alkalinity at ${ta} ppm is too low. Think of total alkalinity as the shock absorber for your pool's pH. When TA is in range (80–120 ppm), small disturbances — a rainstorm, a load of swimmers, a chemical addition — barely move the pH needle. When TA is low, those same events can swing pH by a full point in either direction, making the water constantly uncomfortable and unpredictable to treat. This is why TA must be fixed first: if you raise your pH now without addressing TA, the next rain shower will pull it right back down. Low TA and low pH almost always appear together for exactly this reason.`,
        how: 'Split into two doses, 4 hours apart. Broadcast across the pool surface with the pump running — do not dump the whole amount in at once. Baking soda dissolves and circulates slowly, so patience is important here.',
        lookFor: 'Retest alkalinity the next day. Then recheck your pH — once TA is stabilized, pH often drifts partway back to normal on its own, meaning you may need less pH adjustment than expected. This is the right sequence.',
        note: ph !== null && ph < 7.2 ? 'Low pH and low alkalinity almost always go together. Raising TA first is the correct sequence — pH adjusted before TA is stable will drift back within a day or two.' : undefined,
      })
    } else if (ta < 80) {
      const dose = ((80 - ta) / 10) * 1.5 * v
      raw.push({
        order: 1,
        urgency: 'soon',
        param: 'alkalinity',
        title: 'Raise alkalinity slightly before adjusting pH',
        chemical: 'Baking Soda',
        amount: oz(dose, 'lbs'),
        why: `Alkalinity at ${ta} ppm is just below the 80–120 ppm ideal. Total alkalinity acts as a chemical buffer — it absorbs small pH-changing events (rain, bathers, chemical additions) without letting pH move much. A small baking soda dose now will make your upcoming pH adjustment more stable and longer-lasting.`,
        how: 'Broadcast across the pool surface with the pump running. Let it circulate for several hours.',
        lookFor: 'Retest next day. pH may shift slightly upward once TA rises — check pH before adding any pH increaser, so you do not overshoot.',
      })
    } else if (ta > 140) {
      const dose = Math.round(v * 26 * ((ta - 120) / 10))
      raw.push({
        order: 1,
        urgency: 'soon',
        param: 'alkalinity',
        title: 'Lower total alkalinity',
        chemical: 'pH Reducer (Muriatic Acid)',
        amount: oz(dose, 'oz'),
        why: `Alkalinity at ${ta} ppm is too high. While TA needs to be high enough to stabilize pH, too much of it has the opposite effect — it makes pH stubbornly resistant to adjustment, like trying to steer a heavy vehicle. High TA also creates conditions where calcium scale is more likely to form on pool surfaces and equipment. Bringing TA into range first makes all other chemistry easier to manage.`,
        how: 'Add muriatic acid to the deep end in the evening with the pump running. Pour slowly along the edge — never splash acid. Wear gloves and eye protection. After adding, run the pump for 2 hours. Then aerate the water by aiming a return jet at the surface — this raises pH back up without affecting TA, which is exactly what you want here.',
        lookFor: 'Retest next day. Aeration is your friend after an acid treatment — it naturally raises pH without undoing your TA work. Target 80–120 ppm. pH may also need adjustment once TA settles.',
      })
    } else if (ta > 120) {
      raw.push({
        order: 1,
        urgency: 'routine',
        param: 'alkalinity',
        title: 'Alkalinity slightly high — monitor, no action yet',
        chemical: null,
        amount: null,
        why: `Alkalinity at ${ta} ppm is slightly above the 80–120 ppm sweet spot, but it is not causing problems yet. TA drifts down naturally over time through normal water loss, splash-out, and rain dilution — no chemical intervention is needed.`,
        how: 'No chemical needed. Do not add any baking soda until TA drops below 120 ppm.',
        lookFor: 'Retest weekly. If it climbs above 140 ppm and pH becomes difficult to adjust, a small muriatic acid dose will bring it down.',
      })
    }
  } else {
    // TA not tested — add an advisory step when pH needs adjustment
    if (ph !== null && (ph < 7.2 || ph > 7.8)) {
      raw.push({
        order: 1,
        urgency: 'soon',
        param: 'alkalinity',
        title: 'Test alkalinity before adjusting pH',
        chemical: null,
        amount: null,
        why: `We do not have your alkalinity reading, and this matters. Total alkalinity is the buffer that keeps pH stable — it needs to be in range (80–120 ppm) before a pH adjustment will hold. This is one of the most common mistakes in pool care: adjusting pH repeatedly and wondering why it never stays put. The answer is almost always low TA. Low pH and low TA almost always appear together, often because frequent acid additions have slowly depleted both over time.`,
        how: 'Pick up an alkalinity test strip or tablet test kit and check your TA. If it is below 80 ppm, treat with baking soda first. If above 120 ppm, bring it down with muriatic acid before touching pH.',
        lookFor: 'Once TA is confirmed in range, retest pH — it may have partially self-corrected. Then follow the pH step below if still needed.',
        note: `If you have been chasing pH adjustments that never seem to hold, low alkalinity is the most likely culprit.`,
      })
    }
  }

  // ── pH (effective only after TA is stable) ──────────────────────────────────
  if (ph !== null) {
    const taKnownAndOff = ta !== null && (ta < 60 || ta > 140)
    const taUnknown = ta === null
    const sequenceNote = taKnownAndOff
      ? 'Complete the alkalinity step above first — once TA is stable, this pH adjustment will hold.'
      : taUnknown
      ? 'If you have not tested alkalinity yet, check it before adding this — low TA makes pH corrections unstable and they will not hold.'
      : 'With alkalinity in range, this adjustment will hold well.'

    if (ph < 7.0) {
      const dose = Math.round(v * 12)
      raw.push({
        order: 2,
        urgency: 'soon',
        param: 'ph',
        title: 'Raise pH',
        chemical: 'pH Increaser (Soda Ash · Sodium Carbonate · pH Up)',
        amount: oz(dose, 'oz'),
        why: `pH at ${ph} is too low. Beyond the swimmer discomfort — stinging eyes, irritated skin — low pH is actively corrosive. It slowly etches plaster and grout, damages metal fittings, degrades pool equipment, and eats through vinyl liners over time. Here is the chemistry: at pH ${ph}, a higher percentage of your chlorine is in its active form (hypochlorous acid) — which sounds good, but it also means chlorine is consumed and depleted much faster. You end up using more chlorine to maintain safe levels. Getting pH into the 7.2–7.6 range maximizes how long each dose of chlorine lasts. ${sequenceNote}`,
        how: 'Dissolve in a bucket of pool water first, then pour slowly around the perimeter with the pump running. Do not pour directly into the skimmer.',
        lookFor: 'Retest pH 4–6 hours after adding. Add in increments — it is easier to raise pH a little more if needed than to lower it after overshooting. Target 7.2–7.6.',
      })
    } else if (ph < 7.2) {
      const dose = Math.round(v * 6)
      raw.push({
        order: 2,
        urgency: 'soon',
        param: 'ph',
        title: 'Raise pH slightly',
        chemical: 'pH Increaser (Soda Ash · Sodium Carbonate · pH Up)',
        amount: oz(dose, 'oz'),
        why: `pH at ${ph} is just below the ideal 7.2–7.6 range. At this level, chlorine is slightly more reactive — which means it depletes faster than it should. A small bump up will bring it into range where chlorine lasts longer and equipment is protected. ${sequenceNote}`,
        how: 'Dissolve in a bucket of water before adding — it dissolves better this way. Pour slowly around the perimeter with the pump running.',
        lookFor: 'Retest in 4 hours. Target 7.2–7.6. A single application is usually enough for this small an adjustment.',
      })
    } else if (ph > 7.8) {
      const dose = Math.round(v * 26)
      raw.push({
        order: 2,
        urgency: 'soon',
        param: 'ph',
        title: 'Lower pH',
        chemical: 'pH Reducer (Muriatic Acid)',
        amount: oz(dose, 'oz'),
        why: `pH at ${ph} is too high — and this is where many pool owners are spending money on chlorine without getting the results they expect. Remember the efficiency curve: at pH 7.8, only about 33% of your chlorine is in its active sanitizing form. At pH 8.0, it drops to 21%. This means your pool can test positive for chlorine and still not be sanitizing effectively — the chlorine is there but it is largely inactive. Bringing pH down unlocks the full potential of the chlorine already in your water. ${sequenceNote}`,
        how: 'Add to the deep end in the evening with the pump running. Pour slowly in a thin stream along the wall — never splash muriatic acid. Wear gloves and eye protection. Avoid breathing the fumes. Do not pre-dilute in a small container.',
        lookFor: 'Retest the next morning. Target 7.2–7.6. If pH drops below 7.2, alkalinity may have also come down — retest TA and add a small baking soda dose if needed.',
      })
    } else if (ph > 7.6) {
      const dose = Math.round(v * 13)
      raw.push({
        order: 2,
        urgency: 'routine',
        param: 'ph',
        title: 'Lower pH slightly',
        chemical: 'pH Reducer (Muriatic Acid)',
        amount: oz(dose, 'oz'),
        why: `pH at ${ph} is slightly above the ideal 7.2–7.6 range. Chlorine efficiency starts declining above 7.6 — about 49% of your chlorine is active at 7.5, dropping to 33% by 7.8. A small acid dose now will improve the effectiveness of every chlorine addition you make going forward.`,
        how: 'Add to the deep end in the evening with the pump running. Pour slowly. Wear gloves.',
        lookFor: 'Retest next day. Target 7.2–7.6. One small dose is usually enough for this adjustment.',
      })
    }
  }

  // ── CHLORINE MAINTENANCE (low but not critical — order 3) ───────────────────
  if (fc !== null && fc >= 0.5 && fc < 1) {
    const dose = Math.round(v * 13 * (1 - fc))
    const phOff = ph !== null && (ph < 7.2 || ph > 7.8)
    raw.push({
      order: 3,
      urgency: 'soon',
      param: 'chlorine',
      title: 'Add chlorine',
      chemical: 'Liquid Chlorine',
      amount: oz(dose, 'oz'),
      why: `Free chlorine at ${fc} ppm is below the 1 ppm safe minimum. Chlorine is your pool's primary line of defense against bacteria, algae, and pathogens — and its effectiveness is directly tied to pH. ${phOff ? `By completing the pH adjustment above first, you will get significantly more active sanitizer from the same amount of chlorine you add.` : `With pH in the ideal 7.2–7.6 range, the chlorine you add now will be working at close to full strength.`}\n\nLiquid chlorine (sodium hypochlorite) starts working within minutes and is the fastest way to restore safe levels. It also does not add CYA or significantly affect calcium — making it a versatile choice for regular maintenance. Granular shock works more slowly but stays in the water longer, making it better suited for overnight recovery or when you want longer-lasting results.`,
      how: 'Pour around the perimeter with the pump running. Add in the evening when possible — UV sunlight degrades chlorine rapidly, and an evening addition gives the chlorine hours to circulate and work overnight before the sun can break it down.',
      lookFor: 'Retest in 4 hours. Target 1–3 ppm for normal swimming. If chlorine drops back to low levels within a day, test your CYA — without adequate stabilizer, UV can burn off most of your chlorine within just a few hours on a sunny day.',
      note: cya === null ? `We do not have your CYA reading. If chlorine consistently disappears faster than expected between tests, low or absent stabilizer is almost certainly why. CYA protects chlorine from UV — without it, you are essentially pouring money in and watching the sun take it.` : undefined,
    })
  }

  // ── CYA / STABILIZER (protect the chlorine — order 4) ──────────────────────
  if (cya !== null) {
    if (cya < 20) {
      const dose = ((40 - cya) / 10) * 1.3 * v
      raw.push({
        order: 4,
        urgency: 'soon',
        param: 'cya',
        title: 'Add Cyanuric Acid (CYA)',
        chemical: 'Cyanuric Acid (Stabilizer)',
        amount: oz(dose, 'lbs'),
        why: `CYA at ${cya} ppm is too low. Here is what Cyanuric Acid actually does: it forms a temporary bond with chlorine molecules and acts as a shield against UV radiation. Without that shield, direct sunlight can destroy up to 90% of your pool's chlorine within 2 hours on a clear day. With CYA at the proper level (30–50 ppm), that same chlorine lasts significantly longer — meaning fewer treatments, more consistent protection, and lower chemical costs over the season. This is why CYA is called a stabilizer. Add it after establishing your chlorine level so there is something worth protecting.`,
        how: 'Place stabilizer in an old sock or mesh bag and hang it directly in front of a return jet, or drop it into the skimmer basket with the pump running. Do not try to pre-dissolve it — it needs to dissolve slowly over time. Keep the pump running continuously until fully dissolved.',
        lookFor: 'CYA takes 5–7 days to fully dissolve and register accurately on a test. Once in range, you rarely need to add more within a season — CYA does not evaporate or degrade on its own. You only need to top it off after significant water replacement. Target 30–50 ppm.',
      })
    } else if (cya < 30) {
      const dose = ((40 - cya) / 10) * 1.3 * v
      raw.push({
        order: 4,
        urgency: 'routine',
        param: 'cya',
        title: 'Add Cyanuric Acid (CYA) — small top-up',
        chemical: 'Cyanuric Acid (Stabilizer)',
        amount: oz(dose, 'lbs'),
        why: `CYA at ${cya} ppm is slightly below the ideal 30–50 ppm range. Without enough stabilizer, UV light shortens the lifespan of every chlorine dose you add — you end up adding chlorine more frequently and spending more than you need to. A small top-up now will extend your chlorine's staying power.`,
        how: 'Add to the skimmer basket or in a mesh bag in front of a return jet. Run the pump continuously. It dissolves slowly — do not expect a quick test result.',
        lookFor: 'Retest in 5–7 days. Target 30–50 ppm. CYA accumulates season over season so add conservatively — it is much easier to raise it than to lower it.',
      })
    } else if (cya > 80) {
      raw.push({
        order: 4,
        urgency: 'soon',
        param: 'cya',
        title: 'Dilute CYA — partial drain and refill needed',
        chemical: null,
        amount: null,
        why: `CYA at ${cya} ppm is too high, and this creates a condition most pool owners have heard of but do not fully understand: chlorine lock. Here is what happens — as CYA rises above 80 ppm, the bond it forms with chlorine becomes too strong. The chlorine cannot break free to sanitize. You can have 3 ppm of chlorine on a test strip and still have unsafe, algae-prone water because nearly none of it is in an active form. There is no chemical treatment for this. The only fix is physical dilution — replacing a portion of the water to bring CYA concentration down.`,
        how: 'Drain 20–30% of the pool and refill with fresh water. After refilling, retest CYA and repeat if still above 80 ppm. Stop using any products that contain CYA — this includes stabilizer, trichlor tablets, and dichlor shock — until levels come down.',
        lookFor: 'Retest CYA after refilling and allowing the water to mix for 24 hours. Switch to liquid chlorine or cal-hypo shock for sanitizing while managing this — both are CYA-free and will not continue pushing levels up.',
        note: `The most common cause of chronically high CYA is regular use of slow-dissolve chlorine tabs (trichlor). Each tablet contains a significant amount of CYA, and it accumulates all season. Many pool owners who use tabs year after year eventually reach chlorine lock and do not know why their pool always looks slightly off despite adding chemicals.`,
      })
    } else if (cya > 60) {
      raw.push({
        order: 4,
        urgency: 'routine',
        param: 'cya',
        title: 'Cyanuric Acid (CYA) slightly elevated — monitor',
        chemical: null,
        amount: null,
        why: `CYA at ${cya} ppm is slightly above the ideal range but is not yet causing problems. It will naturally dilute over time through splash-out, backwashing, and rain. No action needed now, but be aware that continuing to use trichlor tabs or dichlor shock will push it higher.`,
        how: 'No chemical needed. Hold off on adding more stabilizer or trichlor products until CYA drops below 60 ppm.',
        lookFor: 'Retest monthly. If CYA climbs to 80 ppm, a partial drain and refill will be necessary to avoid chlorine lock.',
      })
    }
  }

  // ── CALCIUM HARDNESS (slowest to change — order 5) ──────────────────────────
  if (ca !== null) {
    if (ca < 150) {
      const dose = ((200 - ca) / 10) * 1.25 * v
      raw.push({
        order: 5,
        urgency: 'soon',
        param: 'calcium',
        title: 'Raise calcium hardness',
        chemical: 'Calcium Chloride',
        amount: oz(dose, 'lbs'),
        why: `Calcium at ${ca} ppm is too low. Water chemistry always seeks balance — if something is missing from the water, it will pull it from the nearest available source to reach equilibrium. With soft water, that source is your pool itself. Low-calcium water slowly dissolves calcium from plaster, grout, and concrete, etching and pitting surfaces over months and years. It also corrodes metal fittings and equipment. The damage is invisible at first but expensive to repair. Address pH and alkalinity first (those directly affect swimmer safety), then bring calcium up to give the water what it needs so it stops taking it from your pool.`,
        how: 'Always pre-dissolve calcium chloride in a bucket of water before adding it to the pool — dry calcium chloride reacts with water and generates significant heat, which can damage pool surfaces if added directly. Add in 2–3 smaller doses over several days rather than all at once.',
        lookFor: 'Retest 24 hours after each addition. Calcium moves slowly and you want to avoid overshooting. Target 200–400 ppm.',
      })
    } else if (ca < 200) {
      const dose = ((200 - ca) / 10) * 1.25 * v
      raw.push({
        order: 5,
        urgency: 'routine',
        param: 'calcium',
        title: 'Raise calcium slightly',
        chemical: 'Calcium Chloride',
        amount: oz(dose, 'lbs'),
        why: `Calcium at ${ca} ppm is slightly below the 200–400 ppm ideal. Water with insufficient calcium is mildly aggressive — a small top-up now protects your pool surface from slow etching and keeps water chemistry in balance.`,
        how: 'Pre-dissolve in a bucket of water before adding. Add slowly with the pump running.',
        lookFor: 'Retest in a few days. Target 200–400 ppm.',
      })
    } else if (ca > 500) {
      raw.push({
        order: 5,
        urgency: 'soon',
        param: 'calcium',
        title: 'Reduce calcium — partial drain and refill',
        chemical: null,
        amount: null,
        why: `Calcium at ${ca} ppm is high enough to cause visible scale. When calcium saturation exceeds what the water can hold in solution, it precipitates out and deposits on surfaces — that white, chalky buildup on pool walls, tiles, and around equipment fittings. It can also cloud the water and clog filters. Like high CYA, there is no chemical that removes excess calcium from pool water. Dilution is the only fix.`,
        how: 'Drain 20–30% of the pool and refill with fresh water. Do not add any calcium chloride until levels drop below 400 ppm.',
        lookFor: 'Retest after refilling and mixing for 24 hours. If your local water supply is naturally high in calcium (hard water), this situation will recur — ask a pool store about a sequestering agent, which keeps calcium in solution and prevents it from depositing on surfaces.',
      })
    } else if (ca > 400) {
      raw.push({
        order: 5,
        urgency: 'routine',
        param: 'calcium',
        title: 'Calcium slightly elevated — monitor',
        chemical: null,
        amount: null,
        why: `Calcium at ${ca} ppm is slightly above the 200–400 ppm ideal, but not yet at a level that causes problems. No action needed now. Just avoid adding more calcium chloride and keep an eye on it monthly.`,
        how: 'No chemical needed.',
        lookFor: 'Retest monthly. If calcium climbs toward 500 ppm, a partial drain and refill will prevent scale buildup.',
      })
    }
  }

  return raw
    .sort((a, b) => a.order - b.order)
    .map(({ order, ...step }, i) => ({ ...step, step: i + 1 }))
}

export function calculateRecommendations(test: TestInput, volumeGallons: number): RecommendationResult {
  const v = volumeGallons / 10000
  const recs: Rec[] = []

  const MISSING: Record<string, Rec> = {
    ph: { status: 'unknown', param: 'ph', title: 'pH not tested', desc: 'pH controls chlorine effectiveness and swimmer comfort. If too low (< 7.2) it corrodes equipment and irritates skin. If too high (> 7.8) chlorine becomes ineffective and scale forms.', tags: ['Ideal: 7.2 – 7.6', 'Test soon'] },
    free_chlorine: { status: 'unknown', param: 'free_chlorine', title: 'Free chlorine not tested', desc: "Chlorine is your primary defense against bacteria and algae. Below 1 ppm the water is unsafe to swim in. Above 5 ppm it causes eye and skin irritation. HTH strips typically don't include free chlorine — consider a separate liquid or tablet test.", tags: ['Ideal: 1 – 3 ppm', 'Test separately if possible'] },
    total_alkalinity: { status: 'unknown', param: 'total_alkalinity', title: 'Alkalinity not tested', desc: 'Total alkalinity acts as a pH buffer — it keeps pH from swinging wildly with every chemical addition or rain event. When low, pH becomes unpredictable. When high, pH gets stuck and is hard to adjust.', tags: ['Ideal: 80 – 120 ppm', 'Test monthly'] },
    cya: { status: 'unknown', param: 'cya', title: 'Cyanuric Acid (CYA) not tested', desc: 'Cyanuric Acid (CYA) is your pool\'s stabilizer — it shields chlorine from being broken down by UV sunlight. Without it, sunlight can destroy 90% of your chlorine within hours. If CYA gets too high (> 80 ppm) it blocks chlorine from sanitizing, called "chlorine lock."', tags: ['Ideal: 30 – 50 ppm', 'Test monthly'] },
    calcium_hardness: { status: 'unknown', param: 'calcium_hardness', title: 'Calcium hardness not tested', desc: 'Low calcium (< 200 ppm) causes water to aggressively leach calcium from your pool surface, leading to etching and pitting over time. High calcium (> 400 ppm) causes white scale deposits on walls, tiles, and equipment.', tags: ['Ideal: 200 – 400 ppm', 'Test monthly'] },
  }

  // pH
  if (test.ph === null) { recs.push(MISSING.ph) }
  else if (test.ph < 7.0) {
    const dose = Math.round(v * 12)
    recs.push({ status: 'action', param: 'ph', title: 'Raise your pH', desc: `pH is at ${test.ph} — too low. Add pH Increaser (Soda Ash / pH Up) to protect your equipment and swimmer comfort.`, tags: [`pH Increaser (Soda Ash / pH Up) · ${oz(dose, 'oz')}`, 'Re-test in 4 hours'] })
  } else if (test.ph < 7.2) {
    const dose = Math.round(v * 6)
    recs.push({ status: 'monitor', param: 'ph', title: 'pH slightly low', desc: `pH is at ${test.ph}. A small dose of pH Increaser (Soda Ash / pH Up) will bring it into range.`, tags: [`pH Increaser (Soda Ash / pH Up) · ${oz(dose, 'oz')}`, 'Monitor daily'] })
  } else if (test.ph > 7.8) {
    const dose = Math.round(v * 26)
    recs.push({ status: 'action', param: 'ph', title: 'Lower your pH', desc: `pH is at ${test.ph} — too high. Add muriatic acid this evening after sunset.`, tags: [`pH Reducer (Muriatic Acid) · ${oz(dose, 'oz')}`, 'Re-test tomorrow'] })
  } else if (test.ph > 7.6) {
    const dose = Math.round(v * 13)
    recs.push({ status: 'monitor', param: 'ph', title: 'pH slightly high', desc: `pH is at ${test.ph}. A small dose of muriatic acid will bring it into range.`, tags: [`pH Reducer (Muriatic Acid) · ${oz(dose, 'oz')}`, 'Monitor daily'] })
  } else {
    recs.push({ status: 'good', param: 'ph', title: 'pH is perfect', desc: `pH at ${test.ph} — right in the ideal range of 7.2–7.6.`, tags: [] })
  }

  // Free Chlorine
  if (test.free_chlorine === null) { recs.push(MISSING.free_chlorine) }
  else if (test.free_chlorine < 0.5) {
    const dose = Math.round(v * 2 * Math.max(1, 3 - test.free_chlorine))
    recs.push({ status: 'action', param: 'chlorine', title: 'Chlorine critically low — shock now', desc: `Free chlorine at ${test.free_chlorine} ppm — unsafe for swimming. Shock the pool immediately.`, tags: [`Pool Shock · ${oz(dose, 'lbs')}`, 'Do not swim until 1+ ppm', 'Re-test in 2 hours'] })
  } else if (test.free_chlorine < 1) {
    const dose = Math.round(v * 13 * (1 - test.free_chlorine))
    recs.push({ status: 'action', param: 'chlorine', title: 'Add chlorine', desc: `Free chlorine at ${test.free_chlorine} ppm — below the safe minimum of 1 ppm.`, tags: [`Liquid Chlorine · ${oz(dose, 'oz')}`, 'Re-test in 4 hours'] })
  } else if (test.free_chlorine > 5) {
    recs.push({ status: 'monitor', param: 'chlorine', title: 'Chlorine high — wait before swimming', desc: `Free chlorine at ${test.free_chlorine} ppm. Wait 24–48 hours before swimming. Sunlight will naturally lower it.`, tags: ['No chemicals needed', 'Re-test tomorrow'] })
  } else {
    recs.push({ status: 'good', param: 'chlorine', title: 'Chlorine is in range', desc: `Free chlorine at ${test.free_chlorine} ppm. No action needed. Check again in 3 days.`, tags: [] })
  }

  // Total Alkalinity
  if (test.total_alkalinity === null) { recs.push(MISSING.total_alkalinity) }
  else if (test.total_alkalinity < 60) {
    const dose = ((80 - test.total_alkalinity) / 10) * 1.5 * v
    recs.push({ status: 'action', param: 'alkalinity', title: 'Raise total alkalinity', desc: `Alkalinity at ${test.total_alkalinity} ppm — too low. Fix this before adjusting pH or the adjustment will not hold.`, tags: [`Baking Soda · ${oz(dose, 'lbs')}`, 'Add in doses', 'Re-test next day'] })
  } else if (test.total_alkalinity < 80) {
    const dose = ((80 - test.total_alkalinity) / 10) * 1.5 * v
    recs.push({ status: 'monitor', param: 'alkalinity', title: 'Alkalinity slightly low', desc: `Alkalinity at ${test.total_alkalinity} ppm. A small baking soda dose will stabilize it.`, tags: [`Baking Soda · ${oz(dose, 'lbs')}`, 'Monitor weekly'] })
  } else if (test.total_alkalinity > 140) {
    const dose = Math.round(v * 26 * ((test.total_alkalinity - 120) / 10))
    recs.push({ status: 'action', param: 'alkalinity', title: 'Lower total alkalinity', desc: `Alkalinity at ${test.total_alkalinity} ppm — too high. Use muriatic acid and aerate afterward.`, tags: [`pH Reducer (Muriatic Acid) · ${oz(dose, 'oz')}`, 'Aerate after adding', 'Re-test next day'] })
  } else if (test.total_alkalinity > 120) {
    recs.push({ status: 'monitor', param: 'alkalinity', title: 'Alkalinity slightly high', desc: `Alkalinity at ${test.total_alkalinity} ppm. Monitor weekly — it will drift down naturally.`, tags: ['Monitor weekly'] })
  } else {
    recs.push({ status: 'good', param: 'alkalinity', title: 'Alkalinity on target', desc: `Total alkalinity at ${test.total_alkalinity} ppm. Right in range.`, tags: [] })
  }

  // CYA
  if (test.cya === null) { recs.push(MISSING.cya) }
  else if (test.cya < 20) {
    const dose = ((40 - test.cya) / 10) * 1.3 * v
    recs.push({ status: 'action', param: 'cya', title: 'Cyanuric Acid (CYA) too low', desc: `CYA at ${test.cya} ppm — too low. Cyanuric Acid is your pool's stabilizer, and without enough of it, UV sunlight burns off chlorine within hours.`, tags: [`Cyanuric Acid · ${oz(dose, 'lbs')}`, 'Add to skimmer', 'Re-test in 5 days'] })
  } else if (test.cya < 30) {
    const dose = ((40 - test.cya) / 10) * 1.3 * v
    recs.push({ status: 'monitor', param: 'cya', title: 'Cyanuric Acid (CYA) slightly low', desc: `CYA at ${test.cya} ppm. Cyanuric Acid protects chlorine from UV — a small dose will keep your chlorine from burning off in sunlight.`, tags: [`Cyanuric Acid · ${oz(dose, 'lbs')}`, 'Monitor weekly'] })
  } else if (test.cya > 80) {
    recs.push({ status: 'action', param: 'cya', title: 'CYA too high — dilute', desc: `CYA at ${test.cya} ppm. High stabilizer blocks chlorine from working (chlorine lock). Drain and refill 20–30% of the pool.`, tags: ['Partial drain & refill', 'No chemical fix', 'Re-test after refill'] })
  } else if (test.cya > 60) {
    recs.push({ status: 'monitor', param: 'cya', title: 'Cyanuric Acid (CYA) slightly elevated', desc: `CYA at ${test.cya} ppm. Dilute by replacing ~10% of pool water over the next week.`, tags: ['Monitor weekly'] })
  } else {
    recs.push({ status: 'good', param: 'cya', title: 'Cyanuric Acid (CYA) in range', desc: `CYA at ${test.cya} ppm. Cyanuric Acid (CYA) is your pool's stabilizer — it protects chlorine from being broken down by UV sunlight. Your chlorine is well-shielded.`, tags: [] })
  }

  // Calcium Hardness
  if (test.calcium_hardness === null) { recs.push(MISSING.calcium_hardness) }
  else if (test.calcium_hardness < 150) {
    const dose = ((200 - test.calcium_hardness) / 10) * 1.25 * v
    recs.push({ status: 'action', param: 'calcium', title: 'Raise calcium hardness', desc: `Calcium at ${test.calcium_hardness} ppm — too low. Soft water etches plaster and corrodes equipment.`, tags: [`Calcium Chloride · ${oz(dose, 'lbs')}`, 'Add in small doses', 'Re-test next day'] })
  } else if (test.calcium_hardness < 200) {
    const dose = ((200 - test.calcium_hardness) / 10) * 1.25 * v
    recs.push({ status: 'monitor', param: 'calcium', title: 'Calcium slightly low', desc: `Calcium at ${test.calcium_hardness} ppm. A small dose will protect your pool surface.`, tags: [`Calcium Chloride · ${oz(dose, 'lbs')}`, 'Monitor monthly'] })
  } else if (test.calcium_hardness > 500) {
    recs.push({ status: 'action', param: 'calcium', title: 'Calcium too high', desc: `Calcium at ${test.calcium_hardness} ppm. High calcium causes scale and cloudy water. Partial drain and refill needed.`, tags: ['Partial drain & refill', 'Re-test after refill'] })
  } else if (test.calcium_hardness > 400) {
    recs.push({ status: 'monitor', param: 'calcium', title: 'Calcium slightly elevated', desc: `Calcium at ${test.calcium_hardness} ppm. Monitor monthly — avoid adding more calcium.`, tags: ['Monitor monthly'] })
  } else {
    recs.push({ status: 'good', param: 'calcium', title: 'Calcium hardness good', desc: `Calcium at ${test.calcium_hardness} ppm. Your pool surface and equipment are well protected.`, tags: [] })
  }

  const actionCount = recs.filter(r => r.status === 'action').length
  const monitorCount = recs.filter(r => r.status === 'monitor').length
  const health_score = Math.max(10, 100 - actionCount * 18 - monitorCount * 6)

  const treatment_plan = buildTreatmentPlan(test, v)

  return {
    health_score,
    treatment_plan,
    unknown: recs.filter(r => r.status === 'unknown'),
    action: recs.filter(r => r.status === 'action'),
    monitor: recs.filter(r => r.status === 'monitor'),
    good: recs.filter(r => r.status === 'good'),
  }
}
