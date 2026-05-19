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

  // ── SHOCK (critically low chlorine — safety first) ──────────────────────────
  if (fc !== null && fc < 0.5) {
    const dose = Math.round(v * 2 * Math.max(1, 3 - fc))
    raw.push({
      order: 0,
      urgency: 'urgent',
      param: 'chlorine',
      title: 'Shock the pool — do not swim yet',
      chemical: 'Pool Shock',
      amount: oz(dose, 'lbs'),
      why: `Free chlorine is at ${fc} ppm — below the safe minimum of 1 ppm. This is your first priority. Other chemistry adjustments can wait until the water is safe.`,
      how: 'Add shock to the deep end in the evening (UV sunlight destroys shock during the day). If using granular cal-hypo, broadcast it directly — do not pre-dissolve. Run the pump the entire night.',
      lookFor: 'Retest in 2 hours and again in the morning. Do not swim until chlorine reads above 1 ppm. Levels may spike high before dropping to a safe range — that is normal.',
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
        why: `Alkalinity at ${ta} ppm is too low — it is the chemical foundation of balanced water. Until TA is in range (80–120 ppm), any pH adjustment you make will quickly drift back. Low TA almost always accompanies low pH, so fixing this first will likely pull your pH up with it.`,
        how: 'Split into two doses, 4 hours apart. Broadcast across the pool surface with the pump running — do not dump it all in at once. Baking soda dissolves slowly, so give it time to circulate.',
        lookFor: 'Retest alkalinity the next day. Once TA is in range, recheck your pH — it may self-correct partially, meaning you need less pH adjustment than expected.',
        note: ph !== null && ph < 7.2 ? 'Low pH and low alkalinity almost always go together. Raising TA first is the right sequence — if you raise pH before fixing TA, it will drift back within a day or two.' : undefined,
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
        why: `Alkalinity at ${ta} ppm is just below the 80–120 ppm ideal range. A small baking soda dose will stabilize it so that your pH adjustment holds.`,
        how: 'Broadcast across pool surface with pump running.',
        lookFor: 'Retest next day. pH may shift slightly upward once TA rises — check pH before adding any pH increaser.',
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
        why: `Alkalinity at ${ta} ppm is too high — it makes pH difficult to adjust and promotes calcium scale. Use acid to bring TA down before addressing pH.`,
        how: 'Add muriatic acid to the deep end in the evening with the pump running. Pour slowly and never splash — wear gloves and eye protection. After adding, run the pump for 2 hours, then aerate the water (aim a return jet at the surface) to help pH recover naturally.',
        lookFor: 'Retest next day. Aeration raises pH without affecting TA — use it if pH drops too low after the acid treatment. Target TA of 80–120 ppm.',
      })
    } else if (ta > 120) {
      raw.push({
        order: 1,
        urgency: 'routine',
        param: 'alkalinity',
        title: 'Alkalinity slightly high — no action needed yet',
        chemical: null,
        amount: null,
        why: `Alkalinity at ${ta} ppm is slightly above the 80–120 ppm target. It will drift down naturally with normal use.`,
        how: 'No chemical needed. Avoid adding any baking soda until TA drops below 120 ppm.',
        lookFor: 'Retest weekly. If it climbs above 140 ppm, a small muriatic acid dose will be needed.',
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
        why: "We don't have your alkalinity reading. Total alkalinity needs to be in range (80–120 ppm) before pH adjustments will hold — fixing pH without checking TA first often leads to the pH drifting right back.",
        how: 'Pick up an alkalinity test strip or tablet test and check your TA. If it is below 80 ppm, add baking soda first. If above 120 ppm, lower it with muriatic acid before touching pH.',
        lookFor: 'Once TA is confirmed in range, retest pH — it may have self-corrected. Then follow the pH step below.',
        note: "Low pH and low alkalinity almost always go together. If you've been adding acid frequently, your TA may have been pulled down as a result.",
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
      ? "If you haven't tested alkalinity yet, check it before adding this — low TA makes pH corrections unstable."
      : 'With alkalinity in range, this adjustment will hold well.'

    if (ph < 7.0) {
      const dose = Math.round(v * 12)
      raw.push({
        order: 2,
        urgency: 'soon',
        param: 'ph',
        title: 'Raise pH',
        chemical: 'pH Increaser (Soda Ash)',
        amount: oz(dose, 'oz'),
        why: `pH at ${ph} is too low — corrosive to equipment and irritating to skin and eyes. At this level, chlorine is more reactive but also degrades faster. ${sequenceNote}`,
        how: 'Dissolve in a bucket of pool water first, then pour slowly around the perimeter with the pump running. Do not pour directly into the skimmer.',
        lookFor: 'Retest pH 4–6 hours after adding. Add in increments — it is easier to raise it a little more than to lower it if you overshoot. Target 7.2–7.6.',
      })
    } else if (ph < 7.2) {
      const dose = Math.round(v * 6)
      raw.push({
        order: 2,
        urgency: 'soon',
        param: 'ph',
        title: 'Raise pH slightly',
        chemical: 'pH Increaser (Soda Ash)',
        amount: oz(dose, 'oz'),
        why: `pH at ${ph} is just below the ideal 7.2–7.6 range. A small dose will bring it in. ${sequenceNote}`,
        how: 'Dissolve in a bucket of water, then pour slowly around the perimeter with the pump running.',
        lookFor: 'Retest in 4 hours. Target 7.2–7.6.',
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
        why: `pH at ${ph} is too high — chlorine becomes significantly less effective above 7.6. At this level you can have adequate chlorine on paper but poor actual sanitation. ${sequenceNote}`,
        how: 'Add to the deep end in the evening, with the pump running. Pour slowly — never splash acid. Wear gloves and eye protection. Do not pre-dilute in a small bucket of water.',
        lookFor: 'Retest the next morning. Target 7.2–7.6. If pH drops below 7.2, alkalinity may have also dropped — retest TA.',
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
        why: `pH at ${ph} is slightly above the ideal range. Chlorine effectiveness starts declining above 7.6.`,
        how: 'Add to the deep end in the evening with the pump running. Wear gloves.',
        lookFor: 'Retest next day. Target 7.2–7.6.',
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
      why: `Free chlorine at ${fc} ppm is below the safe minimum of 1 ppm. ${phOff ? 'Adding chlorine after balancing pH (step above) means it will work at full strength.' : 'Chlorine is most effective when pH is in the 7.2–7.6 range.'}`,
      how: 'Pour around the perimeter with the pump running, preferably in the evening to minimize UV loss. Liquid chlorine does not raise CYA levels, making it a good choice if stabilizer is already in range.',
      lookFor: 'Retest in 4 hours. Target 1–3 ppm. If chlorine drops quickly between tests, low CYA (stabilizer) may be the cause — it lets UV burn off chlorine within hours.',
      note: cya === null ? "We don't have your CYA reading. If chlorine seems to disappear fast between tests, untested stabilizer levels may be why — CYA protects chlorine from UV." : undefined,
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
        title: 'Add CYA (Cyanuric Acid / Stabilizer)',
        chemical: 'Cyanuric Acid (Stabilizer)',
        amount: oz(dose, 'lbs'),
        why: `CYA at ${cya} ppm is too low. Cyanuric Acid is your pool's stabilizer — without enough of it, UV sunlight can destroy 90% of your chlorine within 2 hours of exposure. Add stabilizer after your chlorine level is established so there is something worth protecting.`,
        how: 'Place stabilizer in an old sock or mesh bag and hang it in front of a return jet, or add it to the skimmer basket with the pump running. Do not pre-dissolve — it needs to dissolve slowly. Run the pump continuously until dissolved.',
        lookFor: 'CYA dissolves slowly — retest in 5–7 days. It does not evaporate or degrade on its own, so you only need to add more when you refill water. Target 30–50 ppm.',
      })
    } else if (cya < 30) {
      const dose = ((40 - cya) / 10) * 1.3 * v
      raw.push({
        order: 4,
        urgency: 'routine',
        param: 'cya',
        title: 'Add a small CYA (Stabilizer) top-up',
        chemical: 'Cyanuric Acid (Stabilizer)',
        amount: oz(dose, 'lbs'),
        why: `CYA at ${cya} ppm is slightly below the ideal 30–50 ppm range. A small dose will protect your chlorine from UV burn-off.`,
        how: 'Add to skimmer or in a sock in front of a return jet. Run pump continuously.',
        lookFor: 'Retest in 5–7 days. Target 30–50 ppm.',
      })
    } else if (cya > 80) {
      raw.push({
        order: 4,
        urgency: 'soon',
        param: 'cya',
        title: 'Dilute CYA — partial drain and refill needed',
        chemical: null,
        amount: null,
        why: `CYA at ${cya} ppm is too high. This causes a condition called "chlorine lock" — chlorine is measurably present but blocked from sanitizing effectively. There is no chemical fix for high CYA; the only solution is to physically dilute the water.`,
        how: 'Drain 20–30% of the pool and refill with fresh water. You may need to repeat if CYA remains above 80 ppm. Stop using any products containing CYA (stabilizer, trichlor pucks, or dichlor shock) until levels come down.',
        lookFor: 'Retest CYA after refilling. Switch to liquid chlorine or cal-hypo for sanitizing — both are CYA-free so they will not continue raising it.',
        note: 'Slow-dissolve chlorine tabs (trichlor) and many types of shock (dichlor) both contain CYA. Regular use accumulates CYA over time — this is a common cause of chlorine lock in pools that use tabs.',
      })
    } else if (cya > 60) {
      raw.push({
        order: 4,
        urgency: 'routine',
        param: 'cya',
        title: 'CYA slightly elevated — monitor',
        chemical: null,
        amount: null,
        why: `CYA at ${cya} ppm is slightly above ideal but not yet causing problems. It will dilute naturally with rain and splash-out over time.`,
        how: 'No chemical needed. Avoid adding more stabilizer or trichlor tabs until it drops below 60 ppm.',
        lookFor: 'Retest monthly. If CYA reaches 80 ppm, a partial drain and refill will be needed to avoid chlorine lock.',
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
        why: `Calcium at ${ca} ppm is too low — soft water is chemically aggressive and will leach calcium from plaster, grout, and metal fittings to balance itself. Address pH and alkalinity first, then calcium.`,
        how: 'Pre-dissolve in a bucket of pool water before adding — never add dry calcium chloride directly to the pool (it heats up on contact and can damage surfaces). Add in 2–3 increments over several days, not all at once.',
        lookFor: 'Retest 24 hours after each addition. Calcium changes slowly. Target 200–400 ppm.',
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
        why: `Calcium at ${ca} ppm is slightly below the 200–400 ppm ideal. A small dose will protect your pool surface.`,
        how: 'Pre-dissolve in a bucket of water, then add slowly with the pump running.',
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
        why: `Calcium at ${ca} ppm will cause white scale deposits to form on pool walls, tiles, and equipment over time. There is no chemical that removes calcium — dilution with fresh water is the only fix.`,
        how: 'Drain 20–30% of the pool and refill. Do not add any calcium chloride until levels drop below 400 ppm.',
        lookFor: 'Retest after refilling. If your fill water is naturally hard, this will recur — ask a pool store about a sequestering agent as an ongoing maintenance product.',
      })
    } else if (ca > 400) {
      raw.push({
        order: 5,
        urgency: 'routine',
        param: 'calcium',
        title: 'Calcium slightly elevated — monitor',
        chemical: null,
        amount: null,
        why: `Calcium at ${ca} ppm is slightly above the ideal range. No action is needed yet.`,
        how: 'No chemical needed. Avoid adding calcium chloride.',
        lookFor: 'Retest monthly. If calcium approaches 500 ppm, a partial drain and refill will be needed.',
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
    cya: { status: 'unknown', param: 'cya', title: 'CYA / Stabilizer not tested', desc: 'Cyanuric Acid (CYA) is your pool\'s stabilizer — it shields chlorine from being broken down by UV sunlight. Without it, sunlight can destroy 90% of your chlorine within hours. If CYA gets too high (> 80 ppm) it blocks chlorine from sanitizing, called "chlorine lock."', tags: ['Ideal: 30 – 50 ppm', 'Test monthly'] },
    calcium_hardness: { status: 'unknown', param: 'calcium_hardness', title: 'Calcium hardness not tested', desc: 'Low calcium (< 200 ppm) causes water to aggressively leach calcium from your pool surface, leading to etching and pitting over time. High calcium (> 400 ppm) causes white scale deposits on walls, tiles, and equipment.', tags: ['Ideal: 200 – 400 ppm', 'Test monthly'] },
  }

  // pH
  if (test.ph === null) { recs.push(MISSING.ph) }
  else if (test.ph < 7.0) {
    const dose = Math.round(v * 12)
    recs.push({ status: 'action', param: 'ph', title: 'Raise your pH', desc: `pH is at ${test.ph} — too low. Add pH Increaser (Soda Ash) to protect your equipment and swimmer comfort.`, tags: [`pH Increaser (Soda Ash) · ${oz(dose, 'oz')}`, 'Re-test in 4 hours'] })
  } else if (test.ph < 7.2) {
    const dose = Math.round(v * 6)
    recs.push({ status: 'monitor', param: 'ph', title: 'pH slightly low', desc: `pH is at ${test.ph}. A small dose of pH Increaser (Soda Ash) will bring it into range.`, tags: [`pH Increaser (Soda Ash) · ${oz(dose, 'oz')}`, 'Monitor daily'] })
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
    recs.push({ status: 'action', param: 'cya', title: 'Add CYA / Stabilizer', desc: `CYA at ${test.cya} ppm — too low. Cyanuric Acid is your pool's stabilizer, and without enough of it, UV sunlight burns off chlorine within hours.`, tags: [`Cyanuric Acid · ${oz(dose, 'lbs')}`, 'Add to skimmer', 'Re-test in 5 days'] })
  } else if (test.cya < 30) {
    const dose = ((40 - test.cya) / 10) * 1.3 * v
    recs.push({ status: 'monitor', param: 'cya', title: 'CYA / Stabilizer slightly low', desc: `CYA at ${test.cya} ppm. Cyanuric Acid protects chlorine from UV — a small dose will keep your chlorine from burning off in sunlight.`, tags: [`Cyanuric Acid · ${oz(dose, 'lbs')}`, 'Monitor weekly'] })
  } else if (test.cya > 80) {
    recs.push({ status: 'action', param: 'cya', title: 'CYA too high — dilute', desc: `CYA at ${test.cya} ppm. High stabilizer blocks chlorine from working (chlorine lock). Drain and refill 20–30% of the pool.`, tags: ['Partial drain & refill', 'No chemical fix', 'Re-test after refill'] })
  } else if (test.cya > 60) {
    recs.push({ status: 'monitor', param: 'cya', title: 'CYA / Stabilizer slightly elevated', desc: `CYA at ${test.cya} ppm. Dilute by replacing ~10% of pool water over the next week.`, tags: ['Monitor weekly'] })
  } else {
    recs.push({ status: 'good', param: 'cya', title: 'CYA / Stabilizer in range', desc: `CYA at ${test.cya} ppm. Cyanuric Acid is your pool's stabilizer — it protects chlorine from being broken down by UV sunlight. Your chlorine is well-shielded.`, tags: [] })
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
