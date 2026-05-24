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
  when: 'today' | 'in-1-2-days' | 'this-week' | 'plan-ahead'
  param: string
  title: string
  chemical: string | null
  amount: string | null
  why: string
  how: string
  lookFor: string
  note?: string
}

export type MaintenanceTip = {
  category: 'testing' | 'chlorine' | 'shock' | 'brushing' | 'seasonal' | 'filter'
  title: string
  body: string
}

export type RecommendationResult = {
  health_score: number
  treatment_plan: TreatmentStep[]
  maintenance: MaintenanceTip[]
  unknown: Rec[]
  action: Rec[]
  monitor: Rec[]
  good: Rec[]
}

// For dry chemicals (shock, alkalinity increaser (baking soda), calcium chloride, CYA, soda ash)
function oz(amount: number, unit: string) {
  if (unit === 'oz' && amount >= 128) return `${(amount / 128).toFixed(1)} gal`
  if (unit === 'oz' && amount >= 16) return `${(amount / 16).toFixed(1)} lbs`
  if (unit === 'lbs' && amount < 1) return `${Math.round(amount * 16)} oz`
  return `${amount % 1 === 0 ? amount : amount.toFixed(1)} ${unit}`
}

// For liquid chemicals (muriatic acid, liquid chlorine) — never converts to lbs
function liq(floz: number): string {
  if (floz >= 128) return `${(floz / 128).toFixed(1)} gal`
  return `${Math.round(floz)} fl oz`
}

// Shows both liquid chlorine and granular cal-hypo shock amounts for maintenance doses
// Conversion: 13 fl oz liquid (10%) ≈ 2 dry oz granular cal-hypo (65%) per 10k gal per 1 ppm
function chlorineBothAmounts(floz: number): string {
  const dryOz = Math.max(1, Math.round(floz / 6.5))
  const dryStr = dryOz < 16 ? `${dryOz} oz` : `${(dryOz / 16).toFixed(1)} lbs`
  return `${liq(floz)} liquid chlorine · or ${dryStr} granular shock`
}

// Shows both liquid muriatic acid and dry acid (sodium bisulfate) amounts
// Conversion: 26 fl oz muriatic (31.45%) ≈ 1.3 lbs dry acid (sodium bisulfate 93%)
// Source: TFP PoolMath standard — 1 lb dry acid ≈ 20 fl oz muriatic
function acidAmount(floz: number): string {
  const liquidStr = liq(floz)
  const dryLbs = Math.round((floz / 20) * 4) / 4
  const dryStr = dryLbs < 1
    ? `${Math.round(dryLbs * 16)} oz`
    : `${dryLbs % 1 === 0 ? dryLbs : dryLbs.toFixed(2).replace(/\.?0+$/, '')} lbs`
  return `${liquidStr} muriatic acid · or ${dryStr} dry acid (93% sodium bisulfate)`
}

// Correct chemical order for balancing pool water:
//   0 — shock (critically unsafe chlorine — safety first, overrides sequence)
//   1 — total alkalinity (foundation; pH adjustments won't hold until TA is stable)
//   2 — pH (once TA is stable, pH adjustments hold)
//   3 — chlorine maintenance (low but not critical; most effective at correct pH)
//   4 — CYA / stabilizer (protect the chlorine you just established)
//   5 — calcium hardness (slow-moving; adjust last)
function buildTreatmentPlan(test: TestInput, v: number): TreatmentStep[] {
  const raw: Array<{ order: number } & Omit<TreatmentStep, 'step' | 'when'>> = []

  const ph = test.ph
  const fc = test.free_chlorine
  const ta = test.total_alkalinity
  const cya = test.cya
  const ca = test.calcium_hardness

  // Track what earlier steps already handle so we never tell the user to add
  // muriatic acid in more than one step.
  let shockHandledPH = false
  let shockHandledTA = false
  let taHandledPH = false

  // ── SHOCK (critically low chlorine — acid first, then shock) ────────────────
  if (fc !== null && fc < 0.5) {
    // Cal-hypo (65%): ~1 lb raises FC by 7 ppm per 10k gallons.
    // CYA-adjusted dose:
    //   CYA unknown or < 20: target 14 ppm (2 lbs/10k) — UV destroys unstabilized chlorine fast
    //   CYA 20–49:           target 10 ppm (1.5 lbs/10k) — standard
    //   CYA 50+:             target 15 ppm (2 lbs/10k)   — high CYA binds some chlorine, need higher peak
    const cyaLow  = cya === null || cya < 20
    const cyaHigh = cya !== null && cya >= 50
    const dosePerTenK = cyaLow || cyaHigh ? 2 : 1.5
    const dose = Math.round(v * dosePerTenK * 2) / 2
    // Liquid chlorine (10–12.5%): 1 lb cal-hypo 65% ≈ 0.86 gal liquid chlorine, rounded to nearest 0.5 gal.
    const liquidDose = Math.round(dose * 0.86 * 2) / 2
    const phHigh = ph !== null && ph > 7.2
    const phUnknown = ph === null
    const taHigh = ta !== null && ta > 140

    // When TA is also high, one acid dose handles both TA and pH — use the
    // larger TA dose. When only pH is off, use the pH-specific dose.
    const taDose = taHigh ? Math.round(v * 26 * ((ta! - 120) / 10)) : 0
    const phOnlyDose = ph !== null && ph > 7.2
      ? Math.round(v * 13 * ((ph - 7.2) / 0.6))
      : Math.round(v * 8)
    const acidDose = taHigh ? taDose : phOnlyDose
    const needsAcid = phHigh || phUnknown || taHigh

    if (needsAcid) shockHandledPH = true
    if (taHigh) shockHandledTA = true

    const phEfficiency = ph !== null
      ? ph <= 7.0 ? '73%' : ph <= 7.2 ? '66%' : ph <= 7.5 ? '49%' : ph <= 7.8 ? '33%' : '21%'
      : null

    const stepTitle = !needsAcid
      ? 'Add chlorine — do not swim yet'
      : taHigh && phHigh
      ? 'Lower alkalinity and pH first, then add chlorine'
      : taHigh
      ? 'Lower alkalinity first, then add chlorine'
      : 'Lower pH first, then add chlorine'

    const stepChemical = !needsAcid
      ? 'Chlorine'
      : taHigh
      ? 'pH Reducer (Muriatic Acid or Dry Acid)\nChlorine\nAim pool jets at surface'
      : 'pH Reducer (Muriatic Acid or Dry Acid)\nChlorine'

    const acidHow = taHigh
      ? `Step 1 — Add pH reducer (${acidAmount(acidDose)}) to the deep end all at once with the pump running — pouring it concentrated in one spot is what pulls alkalinity down. Wear gloves and eye protection. This dose will also lower your pH. Wait 30–60 minutes for it to circulate.\n\nStep 2 — Brush all pool surfaces — walls, floor, steps, and any corners — before adding shock. Algae and bacteria cling to surfaces and the shock cannot reach what it cannot contact. Brushing knocks it into the water where the chlorine can do its job.\n\nStep 3 — `
      : `Step 1 — Add pH reducer (${acidAmount(acidDose)}) to the deep end with the pump running. Wear gloves and eye protection. Wait 30–60 minutes for it to fully circulate through the pool.\n\nStep 2 — Brush all pool surfaces — walls, floor, steps, and any corners — before adding shock. Algae and bacteria cling to surfaces and the shock cannot reach what it cannot contact. Brushing knocks it into the water where the chlorine can do its job.\n\nStep 3 — `

    raw.push({
      order: 0,
      urgency: 'urgent',
      param: 'chlorine',
      title: stepTitle,
      chemical: stepChemical,
      amount: needsAcid
        ? taHigh
          ? `${acidAmount(acidDose)}\n${liquidDose} gal liquid chlorine · or ${oz(dose, 'lbs')} granular shock (${Math.ceil(dose)} × 1-lb bag${Math.ceil(dose) !== 1 ? 's' : ''})\nPoint a return jet toward the water surface — run 2–4 hrs to off-gas CO₂ and raise pH back naturally`
          : `${acidAmount(acidDose)}\n${liquidDose} gal liquid chlorine · or ${oz(dose, 'lbs')} granular shock (${Math.ceil(dose)} × 1-lb bag${Math.ceil(dose) !== 1 ? 's' : ''})`
        : `${liquidDose} gal liquid chlorine · or ${oz(dose, 'lbs')} granular shock (${Math.ceil(dose)} × 1-lb bag${Math.ceil(dose) !== 1 ? 's' : ''})`,
      why: `Free chlorine is at ${fc} ppm — water is unsafe to swim in. Here is something most pool owners never learn: the effectiveness of chlorine is almost entirely controlled by pH. Chlorine exists in two forms in water — active (hypochlorous acid, HOCl) and inactive (hypochlorite ion, OCl⁻). Only the active form kills bacteria and algae. At pH 7.0, about 73% of your chlorine is in that active form. At pH 7.5, it drops to 49%. At pH 7.8, only 33%. At pH 8.0, just 21%. ${phHigh && phEfficiency ? `Your current pH of ${ph} means only about ${phEfficiency} of the shock you add will actually be working. Lowering pH first before shocking means 2–3× more active sanitizer from the same amount of product.` : phUnknown ? `Since pH is untested, add a small acid dose first as a precaution — if your pH is elevated you could waste the majority of the shock you add.` : `With pH already in range, a high percentage of the shock you add will be in its active, sanitizing form.`}${cyaLow ? ` CYA (stabilizer) is ${cya === null ? 'untested' : `at ${cya} ppm — below the effective range`}. Without stabilizer protecting it, UV sunlight destroys chlorine within hours. The dose shown is higher than usual to account for this — but the real fix is getting CYA into the 30–50 ppm range so future chlorine actually holds.` : cyaHigh ? ` CYA at ${cya} ppm is elevated — stabilizer at high levels partially binds chlorine and reduces how much stays "free" and active. A higher shock dose is needed to push past this and reach effective sanitizing levels.` : ''}`,
      how: `${needsAcid
        ? acidHow
        : `Step 1 — Brush all pool surfaces — walls, floor, steps, and any corners. Algae clings to surfaces and chlorine cannot sanitize what it cannot contact. Brushing first makes the shock dramatically more effective.\n\nStep 2 — `}Add shock in the evening — UV sunlight destroys chlorine rapidly, and shocking during the day means much of it is gone before it can do its job. Use ${oz(dose, 'lbs')} of granular cal-hypo (65%) — or ${liquidDose} gal of liquid chlorine (10–12.5%). See product notes below for other shock types. Pour around the perimeter with the pump running.`,
      lookFor: `Retest in 2 hours and again the next morning. Do not swim until chlorine reads above 1 ppm. Chlorine will spike well above normal levels before settling — that is expected and is not a problem.${cyaLow ? ` Your CYA is ${cya === null ? 'untested' : `only ${cya} ppm`} — UV sunlight can wipe out unstabilized chlorine in just a few hours on a sunny day. If levels drop back near zero by morning, that is why: the shock worked but could not hold. Add CYA stabilizer (see next steps) and re-shock once it is in range.` : cyaHigh ? ` With CYA at ${cya} ppm, some of your chlorine is bound by the stabilizer — that is why a higher dose was recommended. If levels drop back near zero, re-shock with the same amount rather than adding more CYA.` : ` If levels drop back near zero within a day or two, check your CYA. Without adequate stabilizer (30–50 ppm), UV sunlight can destroy most of your chlorine within a few hours on a sunny day.`}`,
      note: `WHICH SHOCK SHOULD YOU BUY?\n\nCal-hypo 65% (granular) — Best overall value. This is the standard pool shock sold everywhere — "Shock & Swim," "Super Shock," "Pool Shock" at Walmart, Home Depot, or any pool store. Expect $5–9 for a 1 lb bag or around $25–35 for a 5 lb bucket. Use the dose shown above. Pre-dissolve in a bucket of water first — never pour dry cal-hypo directly on a vinyl liner or tile (it generates heat and can bleach or pit surfaces). Add in the evening with the pump running.\n\nCal-hypo "Extra Strength" 73–78% (granular) — Higher concentration means more chlorine per pound. If the bag says 73%, 75%, or 78% available chlorine, reduce your dose by about 12–15%. Example: if the standard dose is 1.5 lbs, use about 1.3 lbs instead. These bags typically cost slightly more per pound but can be a better value per unit of chlorine if priced right. Same pre-dissolve and liner precautions apply.\n\nLiquid chlorine (sodium hypochlorite, 10–12.5%) — Fastest acting: starts working within minutes. Best choice if you need the pool ready by tonight or the next morning. Adds no CYA or calcium, so it will not affect your stabilizer level. The downside: it degrades quickly in storage — buy fresh and use within a few months. Sold in gallon jugs for about $5–8 each; you will need several gallons per treatment since it is much less concentrated than granular shock.\n\nDichlor shock (56–62%) — Convenient and dissolves easily, but adds stabilizer (CYA) with every dose. If your CYA is already above 40 ppm, avoid dichlor entirely — repeated use will push you toward chlorine lock, where the stabilizer traps the chlorine and makes it ineffective regardless of how much you add. Fine for occasional use early in the season when CYA is fresh.\n\nNon-chlorine shock / MPS (potassium monopersulfate) — DO NOT USE for a pool with FC at zero. MPS is an oxidizer, not a sanitizer — it clears up cloudy water and burns off organic waste, but it cannot kill bacteria or algae. It is best used as a weekly oxidizer boost in a healthy pool between regular chlorine treatments, not as an emergency fix.\n\nBOTTOM LINE: For most situations, granular cal-hypo 65% is the right call — it is effective, affordable, and widely available. If you want the pool open the same day, grab liquid chlorine instead.${phUnknown ? '\n\nIf pH is already at or below 7.2, skip the acid pre-treatment and go straight to shocking.' : ''}`,
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
        chemical: 'Alkalinity Increaser (Baking Soda / Sodium Bicarbonate)',
        amount: oz(dose, 'lbs'),
        why: `Alkalinity at ${ta} ppm is too low. Think of total alkalinity as the shock absorber for your pool's pH. When TA is in range (80–120 ppm), small disturbances — a rainstorm, a load of swimmers, a chemical addition — barely move the pH needle. When TA is low, those same events can swing pH by a full point in either direction, making the water constantly uncomfortable and unpredictable to treat. This is why TA must be fixed first: if you raise your pH now without addressing TA, the next rain shower will pull it right back down. Low TA and low pH almost always appear together for exactly this reason.`,
        how: 'Split into two doses, 4 hours apart. Broadcast across the pool surface with the pump running — do not dump the whole amount in at once. It dissolves and circulates slowly, so patience is important here.',
        lookFor: 'Retest alkalinity the next day. Then recheck your pH — once TA is stabilized, pH often drifts partway back to normal on its own, meaning you may need less pH adjustment than expected. This is the right sequence.',
        note: `${ph !== null && ph < 7.2 ? 'Low pH and low alkalinity almost always go together. Raising TA first is the correct sequence — pH adjusted before TA is stable will drift back within a day or two.\n\n' : ''}Pro tip: Alkalinity Increaser is sold at pool stores as "Alkalinity Up," "Alkalinity Increaser," or "Sodium Bicarbonate." It is identical to grocery store baking soda — the pool store version can cost 3–5× more for the same thing. Arm & Hammer baking soda works perfectly.`,
      })
    } else if (ta < 80) {
      const dose = ((80 - ta) / 10) * 1.5 * v
      raw.push({
        order: 1,
        urgency: 'soon',
        param: 'alkalinity',
        title: 'Raise alkalinity slightly before adjusting pH',
        chemical: 'Alkalinity Increaser (Baking Soda / Sodium Bicarbonate)',
        amount: oz(dose, 'lbs'),
        why: `Alkalinity at ${ta} ppm is just below the 80–120 ppm ideal. Total alkalinity acts as a chemical buffer — it absorbs small pH-changing events (rain, bathers, chemical additions) without letting pH move much. A small alkalinity increaser (baking soda) dose now will make your upcoming pH adjustment more stable and longer-lasting.`,
        how: 'Broadcast across the pool surface with the pump running. Let it circulate for several hours.',
        lookFor: 'Retest next day. pH may shift slightly upward once TA rises — check pH before adding any pH increaser, so you do not overshoot.',
      })
    } else if (ta > 140 && !shockHandledTA) {
      const dose = Math.round(v * 26 * ((ta - 120) / 10))
      const phAlsoHigh = ph !== null && ph > 7.6
      if (phAlsoHigh) taHandledPH = true
      raw.push({
        order: 1,
        urgency: 'soon',
        param: 'alkalinity',
        title: phAlsoHigh ? 'Lower alkalinity and pH' : 'Lower total alkalinity',
        chemical: 'pH Reducer (Muriatic Acid or Dry Acid / pH Down)',
        amount: acidAmount(dose),
        why: phAlsoHigh
          ? `Alkalinity at ${ta} ppm is too high, and your pH at ${ph} is elevated as well — one acid treatment handles both. High TA makes pH stubbornly resistant to adjustment and promotes scale buildup on pool surfaces. The acid addition that brings TA down will also lower your pH, so there is no need to add acid twice.`
          : `Alkalinity at ${ta} ppm is too high. While TA needs to be high enough to stabilize pH, too much of it has the opposite effect — it makes pH stubbornly resistant to adjustment, like trying to steer a heavy vehicle. High TA also creates conditions where calcium scale is more likely to form on pool surfaces and equipment. Bringing TA into range first makes all other chemistry easier to manage.`,
        how: phAlsoHigh
          ? 'Add muriatic acid to the deep end in the evening with the pump running. Pour slowly along the edge — never splash acid. Wear gloves and eye protection. After adding, run the pump for 2 hours. Since your pH also needs to come down, skip the aeration step or do very little of it — let pH settle naturally rather than aerating it back up.'
          : 'Add muriatic acid to the deep end in the evening with the pump running. Pour slowly along the edge — never splash acid. Wear gloves and eye protection. After adding, run the pump for 2 hours. Then angle a return jet toward the water surface so it agitates and splashes — this releases CO₂ from the water, which raises pH back up naturally without reversing the alkalinity reduction. Run it 2–4 hours.',
        lookFor: phAlsoHigh
          ? 'Retest both TA and pH the next day. Target TA 80–120 ppm and pH 7.2–7.6. One acid treatment typically moves both into range.'
          : 'Retest next day. Aeration is your friend after an acid treatment — it naturally raises pH without undoing your TA work. Target 80–120 ppm. pH may also need adjustment once TA settles.',
        note: `ABOUT DRY ACID PRODUCTS\n\nThe dry acid dose shown assumes standard 93% sodium bisulfate — the active ingredient in most pool-grade "pH Down" or "Alkalinity Down" products sold at hardware stores (BioGuard, Clorox, Natural Chemistry, etc.).\n\nMany store-brand products, including some sold at Leslie's, contain only 30–35% sodium bisulfate. At that concentration you would need 2–3× the listed amount to achieve the same result. A bag that says "pH Down" or "Dry Acid" is not always the same strength.\n\nHow to check: look at the label for "Active Ingredient: Sodium Bisulfate ___%" or the percentage listed under "Guaranteed Analysis." If it reads 93%, use the dose shown. If it reads 30–35%, multiply the dose by about 2.5.\n\nBest advice: muriatic acid is the most predictable option — it is a standardized product (31.45% or 20° Baumé) sold everywhere, and our liquid acid dose will be accurate regardless of brand.`,
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
        how: 'No chemical needed. Do not add any alkalinity increaser (baking soda) until TA drops below 120 ppm.',
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
        how: 'Pick up an alkalinity test strip or tablet test kit and check your TA. If it is below 80 ppm, treat with alkalinity increaser (baking soda) first. If above 120 ppm, bring it down with muriatic acid before touching pH.',
        lookFor: 'Once TA is confirmed in range, retest pH — it may have partially self-corrected. Then follow the pH step below if still needed.',
        note: `If you have been chasing pH adjustments that never seem to hold, low alkalinity is the most likely culprit.`,
      })
    }
  }

  // ── pH (effective only after TA is stable) ──────────────────────────────────
  // Skip if shock or TA step already used acid that covers pH — never tell
  // the user to add muriatic acid in more than one step.
  if (ph !== null && !shockHandledPH && !taHandledPH) {
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
        chemical: 'pH Reducer (Muriatic Acid or Dry Acid / pH Down)',
        amount: acidAmount(dose),
        why: `pH at ${ph} is too high — and this is where many pool owners are spending money on chlorine without getting the results they expect. Remember the efficiency curve: at pH 7.8, only about 33% of your chlorine is in its active sanitizing form. At pH 8.0, it drops to 21%. This means your pool can test positive for chlorine and still not be sanitizing effectively — the chlorine is there but it is largely inactive. Bringing pH down unlocks the full potential of the chlorine already in your water. ${sequenceNote}`,
        how: 'Add to the deep end in the evening with the pump running. Pour slowly in a thin stream along the wall — never splash muriatic acid. Wear gloves and eye protection. Avoid breathing the fumes. Do not pre-dilute in a small container.',
        lookFor: 'Retest the next morning. Target 7.2–7.6. If pH drops below 7.2, alkalinity may have also come down — retest TA and add a small alkalinity increaser (baking soda) dose if needed.',
      })
    } else if (ph > 7.6) {
      const dose = Math.round(v * 13)
      raw.push({
        order: 2,
        urgency: 'routine',
        param: 'ph',
        title: 'Lower pH slightly',
        chemical: 'pH Reducer (Muriatic Acid or Dry Acid / pH Down)',
        amount: acidAmount(dose),
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
      chemical: 'Liquid Chlorine or Granular Shock',
      amount: chlorineBothAmounts(dose),
      why: `Free chlorine at ${fc} ppm is below the 1 ppm safe minimum. Chlorine is your pool's primary line of defense against bacteria, algae, and pathogens — and its effectiveness is directly tied to pH. ${phOff ? `By completing the pH adjustment above first, you will get significantly more active sanitizer from the same amount of chlorine you add.` : `With pH in the ideal 7.2–7.6 range, the chlorine you add now will be working at close to full strength.`}`,
      how: 'Pour around the perimeter with the pump running. Add in the evening when possible — UV sunlight degrades chlorine rapidly, and an evening addition gives the chlorine hours to circulate and work overnight before the sun can break it down.',
      lookFor: 'Retest in 4 hours. Target 1–3 ppm for normal swimming. If chlorine drops back to low levels within a day, test your CYA — without adequate stabilizer, UV can burn off most of your chlorine within just a few hours on a sunny day.',
      note: `Liquid chlorine (sodium hypochlorite): works within minutes, leaves no residue, and does not add CYA or calcium — best choice for a quick same-day top-up or if you plan to swim soon.\n\nGranular shock (cal-hypo): takes 30–60 minutes to fully dissolve and activate, but releases chlorine more slowly and stays in the water longer — better for an end-of-day or overnight treatment. Pre-dissolve in a bucket of water before adding — never pour dry granular directly on a vinyl liner.\n\nAvoid dichlor shock for routine top-ups: it adds CYA with every dose and will slowly push your stabilizer levels too high over a season.${cya === null ? '\n\nNote: we do not have your CYA reading. If chlorine disappears faster than expected between tests, low stabilizer is almost certainly why.' : ''}`,
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
        urgency: 'routine',
        param: 'cya',
        title: 'CYA elevated — plan a partial drain when conditions are right',
        chemical: null,
        amount: null,
        why: `CYA at ${cya} ppm is above the 80 ppm threshold where chlorine lock can begin. When CYA gets too high, the bond it forms with chlorine becomes so strong that the chlorine cannot break free to sanitize. You can test positive for chlorine and still have water that is not effectively killing bacteria. There is no chemical treatment — the only fix is replacing a portion of the water. This is not an emergency this week, but it is worth planning for.`,
        how: `Plan this for a mild-weather day — not during a heat wave, and not right after you have just refilled the pool. Drain 20–30% and refill with fresh water. After refilling, retest CYA and repeat if still above 80 ppm. While waiting for the right time, switch to liquid chlorine or cal-hypo shock — both are CYA-free and will not push levels higher. Stop using trichlor tabs or dichlor products until CYA comes down.`,
        lookFor: 'Retest CYA 24 hours after refilling and mixing. Target 30–50 ppm. If your local tap water is already high in CYA, consider having it tested — some municipal supplies contain stabilizer.',
        note: `The most common cause of chronically high CYA is regular use of slow-dissolve trichlor tabs. Each tablet adds CYA alongside chlorine, and it accumulates all season with no way to remove it except dilution. Many pool owners who use tabs year after year hit chlorine lock and never understand why the pool never looks quite right despite constant chemical additions.`,
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

  const sorted = raw.sort((a, b) => a.order - b.order)
  const taHasChemical = sorted.some(r => r.order === 1 && r.param === 'alkalinity' && r.chemical !== null)

  return sorted.map(({ order, ...step }, i) => {
    let when: TreatmentStep['when']
    if (order === 0) when = 'today'
    else if (order === 1) when = 'today'
    else if (order === 2) when = taHasChemical ? 'in-1-2-days' : 'today'
    else if (order === 3) when = 'today'
    else if (order === 4 && step.chemical === null) when = 'plan-ahead'
    else if (order === 4) when = 'this-week'
    else when = step.chemical === null ? 'plan-ahead' : 'this-week'
    return { ...step, step: i + 1, when }
  })
}

function generateMaintenance(test: TestInput): MaintenanceTip[] {
  const tips: MaintenanceTip[] = []

  // Testing frequency
  tips.push({
    category: 'testing',
    title: 'Test twice a week in warm weather',
    body: 'Check pH and free chlorine at least twice a week during spring and summer — chemistry shifts faster in warm water and under heavy use. Once a week is usually enough in cooler months.',
  })

  // Chlorine guidance tuned to CYA level
  if (test.cya !== null && test.cya > 60) {
    tips.push({
      category: 'chlorine',
      title: `Keep chlorine at 2–3 ppm while CYA is elevated (currently ${test.cya} ppm)`,
      body: 'High CYA reduces how much chlorine is available to sanitize. Until CYA comes down, target the higher end of the range and do not let free chlorine drop below 2 ppm.',
    })
  } else if (test.cya !== null && test.cya < 30) {
    tips.push({
      category: 'chlorine',
      title: `Chlorine burns off fast — CYA is low (${test.cya} ppm)`,
      body: 'Without enough stabilizer, UV destroys chlorine within hours on a sunny day. Test every 1–2 days and add chlorine more frequently until CYA reaches 30–50 ppm. Always add chlorine in the evening.',
    })
  } else {
    tips.push({
      category: 'chlorine',
      title: 'Add chlorine when it drops below 1 ppm',
      body: 'Check twice a week. Add liquid chlorine or granular shock when readings dip below 1 ppm. Adding in the evening prevents UV from burning off a large portion of what you just added before it circulates.',
    })
  }

  // When to shock
  tips.push({
    category: 'shock',
    title: 'Shock after heavy rain, parties, or if water looks off',
    body: 'Shock the pool after significant rainfall (rain dilutes and destabilizes chemistry), after heavy swimmer loads, if chlorine reads 0, or if the water looks hazy. In peak summer heat, a weekly shock as prevention is a good habit.',
  })

  // Brushing
  tips.push({
    category: 'brushing',
    title: 'Brush weekly — algae starts on surfaces, not in the water',
    body: 'Brush walls, floor, steps, and shaded corners once a week. Algae and biofilm establish on surfaces before they are visible in the water — brushing breaks it loose so chlorine can reach it. Pay extra attention to low-flow areas like behind ladders and under steps.',
  })

  // Hot weather
  tips.push({
    category: 'seasonal',
    title: 'In heat above 85°F — chlorine demand roughly doubles',
    body: 'Hot water accelerates chlorine consumption and algae growth. During heat waves: keep chlorine at 2–3 ppm, run the filter 10–12 hours per day, and consider shocking weekly even if the water looks clear. After heavy rain in summer, test within 24 hours.',
  })

  // Filter runtime
  tips.push({
    category: 'filter',
    title: 'Run the filter 8–12 hours per day',
    body: 'Circulation is the foundation of clear water — chemicals cannot do their job without it. In summer or during heat waves, run closer to 12 hours. In cooler months or off-season, 6–8 hours is usually enough. If your pool stays cloudy despite correct chemistry, run the filter 24 hours until it clears.',
  })

  // Salt pool addendum
  if (test.salt !== null && test.salt > 500) {
    tips.push({
      category: 'filter',
      title: 'Salt cell: inspect every 3 months for scale',
      body: 'Calcium scale on the salt cell reduces chlorine output significantly. Every 3 months, inspect the cell and clean with diluted muriatic acid if you see white deposits. Keep salt in the 2700–3400 ppm range for best performance.',
    })
  }

  return tips
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
    recs.push({ status: 'action', param: 'ph', title: 'Lower your pH', desc: `pH is at ${test.ph} — too high. Add pH reducer this evening after sunset.`, tags: [`pH Reducer (Muriatic Acid or Dry Acid) · ${acidAmount(dose)}`, 'Re-test tomorrow'] })
  } else if (test.ph > 7.6) {
    const dose = Math.round(v * 13)
    recs.push({ status: 'monitor', param: 'ph', title: 'pH slightly high', desc: `pH is at ${test.ph}. A small dose of pH reducer will bring it into range.`, tags: [`pH Reducer (Muriatic Acid or Dry Acid) · ${acidAmount(dose)}`, 'Monitor daily'] })
  } else if (test.free_chlorine !== null && test.free_chlorine < 0.5 && test.ph > 7.2) {
    // pH is technically in range, but needs to come down to 7.2 before shocking —
    // high pH wastes most of a shock dose. Show as monitor so it doesn't contradict the treatment plan.
    recs.push({ status: 'monitor', param: 'ph', title: 'Lower pH to 7.2 before shocking', desc: `pH at ${test.ph} is in range for normal use, but lower it to 7.2 first — at higher pH most of the shock you add is wasted and won't sanitize effectively.`, tags: [] })
  } else {
    recs.push({ status: 'good', param: 'ph', title: 'pH is perfect', desc: `pH at ${test.ph} — right in the ideal range of 7.2–7.6.`, tags: [] })
  }

  // Free Chlorine
  if (test.free_chlorine === null) { recs.push(MISSING.free_chlorine) }
  else if (test.free_chlorine < 0.5) {
    const cyaLow  = test.cya === null || test.cya < 20
    const cyaHigh = test.cya !== null && test.cya >= 50
    const dosePerTenK = cyaLow || cyaHigh ? 2 : 1.5
    const dose = Math.round(v * dosePerTenK * 2) / 2
    const phNeedsWork = test.ph !== null && test.ph > 7.2
    if (phNeedsWork) {
      recs.push({ status: 'action', param: 'chlorine', title: 'Chlorine critically low — two steps', desc: `Free chlorine at ${test.free_chlorine} ppm — unsafe for swimming. Step 1: add pH reducer to bring pH to 7.2. Step 2: shock the pool. At pH ${test.ph}, high pH makes most of the shock ineffective — lower it first and the same dose works 2–3× better.`, tags: [] })
    } else {
      recs.push({ status: 'action', param: 'chlorine', title: 'Chlorine critically low — shock now', desc: `Free chlorine at ${test.free_chlorine} ppm — unsafe for swimming. Shock the pool this evening. See the treatment plan below for exact dose.`, tags: [] })
    }
  } else if (test.free_chlorine < 1) {
    const dose = Math.round(v * 13 * (1 - test.free_chlorine))
    recs.push({ status: 'action', param: 'chlorine', title: 'Add chlorine', desc: `Free chlorine at ${test.free_chlorine} ppm — below the safe minimum of 1 ppm.`, tags: [`Liquid or Granular · ${chlorineBothAmounts(dose)}`, 'Re-test in 4 hours'] })
  } else if (test.free_chlorine > 5) {
    recs.push({ status: 'monitor', param: 'chlorine', title: 'Chlorine high — wait before swimming', desc: `Free chlorine at ${test.free_chlorine} ppm. Wait 24–48 hours before swimming. Sunlight will naturally lower it.`, tags: ['No chemicals needed', 'Re-test tomorrow'] })
  } else {
    recs.push({ status: 'good', param: 'chlorine', title: 'Chlorine is in range', desc: `Free chlorine at ${test.free_chlorine} ppm. No action needed. Check again in 3 days.`, tags: [] })
  }

  // Total Alkalinity
  if (test.total_alkalinity === null) { recs.push(MISSING.total_alkalinity) }
  else if (test.total_alkalinity < 60) {
    const dose = ((80 - test.total_alkalinity) / 10) * 1.5 * v
    recs.push({ status: 'action', param: 'alkalinity', title: 'Raise total alkalinity', desc: `Alkalinity at ${test.total_alkalinity} ppm — too low. Fix this before adjusting pH or the adjustment will not hold.`, tags: [`Alkalinity Increaser (Baking Soda / Sodium Bicarbonate) · ${oz(dose, 'lbs')}`, 'Add in doses', 'Re-test next day'] })
  } else if (test.total_alkalinity < 80) {
    const dose = ((80 - test.total_alkalinity) / 10) * 1.5 * v
    recs.push({ status: 'monitor', param: 'alkalinity', title: 'Alkalinity slightly low', desc: `Alkalinity at ${test.total_alkalinity} ppm. A small alkalinity increaser (baking soda) dose will stabilize it.`, tags: [`Alkalinity Increaser (Baking Soda / Sodium Bicarbonate) · ${oz(dose, 'lbs')}`, 'Monitor weekly'] })
  } else if (test.total_alkalinity > 140) {
    const dose = Math.round(v * 26 * ((test.total_alkalinity - 120) / 10))
    recs.push({ status: 'action', param: 'alkalinity', title: 'Lower total alkalinity', desc: `Alkalinity at ${test.total_alkalinity} ppm — too high. Add pH reducer to the deep end, then aim a return jet toward the surface and run the pump 2–4 hours — this naturally raises pH back up without reversing the alkalinity drop.`, tags: [] })
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
  const maintenance = generateMaintenance(test)

  return {
    health_score,
    treatment_plan,
    maintenance,
    unknown: recs.filter(r => r.status === 'unknown'),
    action: recs.filter(r => r.status === 'action'),
    monitor: recs.filter(r => r.status === 'monitor'),
    good: recs.filter(r => r.status === 'good'),
  }
}
