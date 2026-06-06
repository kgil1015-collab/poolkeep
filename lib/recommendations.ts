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
  waitAfter?: string | null   // timing guidance before starting the next step
}

export type MaintenanceTip = {
  category: 'testing' | 'chlorine' | 'shock' | 'brushing' | 'seasonal' | 'filter' | 'skimmer' | 'cartridge' | 'enzyme'
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

// For dry chemicals (shock, alkalinity increaser, calcium chloride, CYA, soda ash)
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
function chlorineBothAmounts(floz: number): string {
  const dryOz = Math.max(1, Math.round(floz / 6.5))
  const dryStr = dryOz < 16 ? `${dryOz} oz` : `${(dryOz / 16).toFixed(1)} lbs`
  return `${liq(floz)} liquid chlorine · or ${dryStr} granular shock`
}

// Shows both liquid muriatic acid and dry acid amounts
function acidAmount(floz: number): string {
  const liquidStr = liq(floz)
  const dryLbs = Math.round((floz / 20) * 4) / 4
  const dryStr = dryLbs < 1
    ? `${Math.round(dryLbs * 16)} oz`
    : `${dryLbs % 1 === 0 ? dryLbs : dryLbs.toFixed(2).replace(/\.?0+$/, '')} lbs`
  return `${liquidStr} muriatic acid · or ${dryStr} dry acid (93% sodium bisulfate)`
}

// ─── Salt pool ranges ────────────────────────────────────────────────────────
// Salt pools use a salt chlorine generator (SWG). Key differences from chlorine pools:
//   CYA target is 70–80 ppm (SWG needs more stabilizer to prevent UV burnoff)
//   TA target is 80–100 ppm (tighter to help buffer the pH rise SWGs cause)
//   Calcium target is 200–350 ppm (tighter — scale on the cell reduces efficiency)
//   Chlorine treatment = adjust SWG output, not add chemicals
//   pH rises naturally over time due to electrolysis — acid additions are normal

const SALT_RANGES = {
  cya:  { actionLow: 50, monLow: 70, monHigh: 90,  actionHigh: 100 },
  ta:   { actionLow: 60, monLow: 80, monHigh: 100, actionHigh: 120 },
  ca:   { actionLow: 150, monLow: 200, monHigh: 350, actionHigh: 500 },
}

const CHLORINE_RANGES = {
  cya:  { actionLow: 20, monLow: 30, monHigh: 75,  actionHigh: 100 },
  ta:   { actionLow: 60, monLow: 80, monHigh: 120, actionHigh: 140 },
  ca:   { actionLow: 150, monLow: 200, monHigh: 400, actionHigh: 600 },
}

// Correct chemical order for balancing pool water:
//   0 — shock / chlorine emergency
//   1 — total alkalinity (foundation)
//   2 — pH (holds once TA is stable)
//   3 — chlorine maintenance
//   4 — CYA / stabilizer
//   5 — calcium hardness (slow-moving)
function buildTreatmentPlan(test: TestInput, v: number, isSalt: boolean): TreatmentStep[] {
  const raw: Array<{ order: number } & Omit<TreatmentStep, 'step' | 'when'>> = []

  const ph = test.ph
  const fc = test.free_chlorine
  const ta = test.total_alkalinity
  const cya = test.cya
  const ca = test.calcium_hardness

  let shockHandledPH = false
  let shockHandledTA = false
  let taHandledPH = false

  const R = isSalt ? SALT_RANGES : CHLORINE_RANGES

  // ── CRITICALLY LOW CHLORINE (order 0) ───────────────────────────────────────
  if (fc !== null && fc < 0.5) {
    const phHigh    = ph !== null && ph > 7.2
    const phUnknown = ph === null
    const taHigh    = ta !== null && ta > R.ta.actionHigh
    const needsAcid = phHigh || phUnknown || taHigh

    if (needsAcid) shockHandledPH = true
    if (taHigh)    shockHandledTA = true

    // For the shock context, always use a pH-targeted dose — do NOT try to fix
    // all of TA in one shot during a chlorine emergency. High TA adds buffering,
    // so use the full pH-lowering dose (v*26) rather than the scaled phOnlyDose.
    const phOnlyDose = ph !== null && ph > 7.2
      ? Math.round(v * 13 * ((ph - 7.2) / 0.6))
      : Math.round(v * 8)
    const acidDose = taHigh ? Math.round(v * 26) : phOnlyDose

    const phEfficiency = ph !== null
      ? ph <= 7.0 ? '73%' : ph <= 7.2 ? '66%' : ph <= 7.5 ? '49%' : ph <= 7.8 ? '33%' : '21%'
      : null

    if (isSalt) {
      // ── Salt pool: SWG boost first, liquid chlorine as emergency backup ──────
      const acidStep = needsAcid
        ? `Step 1 — Add muriatic acid (${acidAmount(acidDose)}) to the deep end with the pump running. Wear gloves and eye protection. Wait 30–60 minutes to circulate.\n\n`
        : ''

      raw.push({
        order: 0,
        urgency: 'urgent',
        param: 'chlorine',
        title: needsAcid
          ? 'Lower pH first, then boost your salt generator'
          : 'Boost your salt generator — do not swim yet',
        chemical: needsAcid
          ? 'Muriatic Acid (or Dry Acid · pH Down)\nSalt Generator — set to 100% / boost mode'
          : 'Salt Generator — set to 100% / boost mode',
        amount: needsAcid
          ? `${acidAmount(acidDose)}\nSet SWG to 100% output for 24–48 hours`
          : 'Set SWG to 100% output for 24–48 hours',
        why: `Free chlorine at ${fc} ppm — water is unsafe to swim in. Your salt generator produces chlorine continuously — running it at maximum output is the right first response. ${needsAcid && phEfficiency ? `Your pH at ${ph} means only about ${phEfficiency} of any chlorine being produced is in its active sanitizing form. Lowering pH first lets your generator work 2–3× more efficiently.` : ''} For a salt pool, avoid cal-hypo shock unless absolutely necessary — it raises calcium hardness, which scales your salt cell and reduces its output over time.`,
        how: `${acidStep}Step ${needsAcid ? '2' : '1'} — Set your salt generator to maximum output (100%) and activate boost or superchlorinate mode if available. Run the pump continuously.\n\nStep ${needsAcid ? '3' : '2'} — Brush all pool surfaces — walls, floor, steps, and corners — before expecting chlorine to recover. Algae clings to surfaces and the generator cannot sanitize what circulation cannot reach.\n\nIf FC does not recover above 1 ppm within 48 hours at 100% output: add liquid chlorine (sodium hypochlorite) as a one-time boost — ${Math.round(v * 0.86 * 1.5)} gal. Do NOT use cal-hypo shock in a salt pool.`,
        lookFor: `Do not swim until FC tests below 5 ppm — always test before getting in. Retest after 24 hours at max SWG output. If chlorine recovers and then drops back quickly, check your salt level and consider inspecting the cell for scale buildup.`,
        note: `SALT POOL SHOCK GUIDE\n\nFirst response — always try increasing SWG output before adding chemicals. The generator is designed to handle normal chlorine demand; a 24–48 hour boost cycle at 100% resolves most low-chlorine situations without manual additions.\n\nIf SWG boost alone isn't working after 48 hours:\nLiquid chlorine (sodium hypochlorite, 10–12.5%) — best emergency option for salt pools. Adds no calcium or CYA, works fast, compatible with your system.\n\nDO NOT use cal-hypo (calcium hypochlorite) shock — it raises calcium hardness significantly, and at high calcium levels your salt cell builds scale that reduces output and shortens cell life. If you have no liquid chlorine available, use it once in an emergency, but liquid is strongly preferred.\n\nDichlor shock — adds CYA with every dose. Since your salt pool targets 70–80 ppm CYA (already higher than a chlorine pool), dichlor will push CYA toward chlorine lock. Avoid repeated use.\n\nNon-chlorine shock (MPS) — an oxidizer, not a sanitizer. Useful for clearing cloudy water or reducing chlorine demand, but will not raise FC to safe levels.\n\nIf chlorine keeps dropping despite good SWG output: check salt level (2700–3400 ppm), inspect cell for scale, and confirm cell is not past its lifespan (typically 3–5 years).`,
      })
    } else {
      // ── Standard chlorine pool shock ─────────────────────────────────────────
      const cyaLow  = cya === null || cya < 20
      const cyaHigh = cya !== null && cya >= 50
      const dosePerTenK = cyaLow || cyaHigh ? 2 : 1.5
      const dose = Math.round(v * dosePerTenK * 2) / 2
      const liquidDose = Math.round(dose * 0.86 * 2) / 2

      const stepTitle = !needsAcid
        ? 'Add chlorine — do not swim yet'
        : taHigh && ph !== null && ph > 7.2
        ? 'Lower alkalinity and pH first, then add chlorine'
        : taHigh
        ? 'Lower alkalinity first, then add chlorine'
        : 'Lower pH first, then add chlorine'

      const stepChemical = !needsAcid
        ? 'Chlorine'
        : taHigh
        ? 'Muriatic Acid (or Dry Acid · pH Down)\nChlorine\nAim pool jets at surface'
        : 'Muriatic Acid (or Dry Acid · pH Down)\nChlorine'

      const acidHow = taHigh
        ? `Step 1 — Add muriatic acid (${acidAmount(acidDose)}) to the deep end all at once with the pump running — pouring it concentrated in one spot is what pulls alkalinity down. Wear gloves and eye protection. This dose will also lower your pH. Wait 30–60 minutes for it to circulate.\n\nStep 2 — Brush all pool surfaces — walls, floor, steps, and any corners — before adding shock. Algae and bacteria cling to surfaces and the shock cannot reach what it cannot contact. Brushing knocks it into the water where the chlorine can do its job.\n\nStep 3 — `
        : `Step 1 — Add muriatic acid (${acidAmount(acidDose)}) to the deep end with the pump running. Wear gloves and eye protection. Wait 30–60 minutes for it to fully circulate through the pool.\n\nStep 2 — Brush all pool surfaces — walls, floor, steps, and any corners — before adding shock. Algae and bacteria cling to surfaces and the shock cannot reach what it cannot contact. Brushing knocks it into the water where the chlorine can do its job.\n\nStep 3 — `

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
        lookFor: `Do not swim until FC tests below 5 ppm — always test before getting in, do not guess by time. Liquid chlorine loses potency quickly in heat and direct sun, so in hot weather you may be able to retest in 1–4 hours. Granular shock takes longer to work through — retest the next morning. Chlorine will spike well above normal levels right after adding; that is expected and not a problem.${cyaLow ? ` Your CYA is ${cya === null ? 'untested' : `only ${cya} ppm`} — UV sunlight can wipe out unstabilized chlorine in just a few hours on a sunny day. If levels drop back near zero by morning, that is why: the shock worked but could not hold. Add CYA stabilizer (see next steps) and re-shock once it is in range.` : cyaHigh ? ` With CYA at ${cya} ppm, some of your chlorine is bound by the stabilizer — that is why a higher dose was recommended. If levels drop back near zero, re-shock with the same amount rather than adding more CYA.` : ` If levels drop back near zero within a day or two, check your CYA. Without adequate stabilizer (30–50 ppm), UV sunlight can destroy most of your chlorine within a few hours on a sunny day.`}`,
        note: (() => {
          const caIsHigh = ca !== null && ca > (isSalt ? SALT_RANGES.ca.monHigh : CHLORINE_RANGES.ca.monHigh)
          return `WHEN TO ADD CHLORINE — AND WHY TIMING MATTERS\n\nAlways add chlorine in the evening, never midday. UV sunlight breaks down free chlorine rapidly — in hot sunny weather, a significant portion of what you add can be destroyed within a few hours before it even circulates. Adding after sunset gives the chlorine the whole night to work.\n\nLiquid chlorine: starts working within minutes. Retest in 1–4 hours. Short lifespan in storage — buy fresh.\nGranular shock: takes 30–60 min to fully dissolve, releases more slowly. Retest the next morning.\n\nWHICH PRODUCT TO BUY\n\nLiquid chlorine (sodium hypochlorite, 10–12.5%) — Fastest acting, most pool-friendly option for regular use. Adds zero calcium hardness and zero CYA. Best if you need the pool open same-day.${caIsHigh ? ' ✓ Especially recommended for your pool — calcium is already elevated, and liquid chlorine adds none.' : ''} Add in the PM, retest in 1–4 hours. Buy fresh — it degrades in storage within a few months.\n\nCal-hypo 65% (granular) — Standard shock sold everywhere ("Shock & Swim," "Super Shock," "Pool Shock"). Effective and affordable. Pre-dissolve in a bucket of water first — never pour dry cal-hypo on a vinyl liner or tile. Add in the evening, retest next morning.\n⚠️ Cal-hypo raises calcium hardness: each pound adds roughly 5–7 ppm calcium per 10,000 gallons. In hard water regions like Arizona, repeated use compounds already-high calcium — leading to scale on surfaces, plumbing, and equipment.${caIsHigh ? ` Your calcium is currently at ${ca} ppm — liquid chlorine is the smarter regular choice.` : ' If calcium creeps above 400 ppm, switch to liquid chlorine for ongoing use.'}\n\nCal-hypo 73–78% "Extra Strength" — More chlorine per pound. Reduce dose by 12–15% vs. 65% cal-hypo. Same calcium impact applies.\n\nDichlor shock (56–62%) — Adds CYA with every dose. Avoid if CYA is above 40 ppm — it will push you toward chlorine lock. Fine early in the season only.\n\nNon-chlorine shock / MPS — An oxidizer, not a sanitizer. Will not rescue a pool with zero FC. Use only as a weekly oxidizer boost in a healthy, balanced pool.\n\nBOTTOM LINE: ${caIsHigh ? 'Your calcium is already elevated — liquid chlorine is the right call for regular use. No calcium, no CYA, fast-acting. Add in the PM and retest in 1–4 hours.' : 'For most pools, granular cal-hypo 65% is effective and affordable. If you need the pool open today, liquid chlorine is faster. Either way — always add in the evening.'}${phUnknown ? '\n\nIf pH is already at or below 7.2, skip the acid pre-treatment and go straight to shocking.' : ''}`
        })(),
      })
    }
  }

  // ── TOTAL ALKALINITY (must be stable before pH adjustment will hold) ────────
  if (ta !== null) {
    if (ta < R.ta.actionLow) {
      const dose = ((R.ta.monLow - ta) / 10) * 1.5 * v
      raw.push({
        order: 1,
        urgency: 'soon',
        param: 'alkalinity',
        title: 'Raise total alkalinity first',
        chemical: 'Alkalinity Increaser (Baking Soda / Sodium Bicarbonate)',
        amount: oz(dose, 'lbs'),
        why: `Alkalinity at ${ta} ppm is too low. Think of total alkalinity as the shock absorber for your pool's pH. When TA is in range (${R.ta.monLow}–${R.ta.monHigh} ppm), small disturbances — a rainstorm, a load of swimmers, a chemical addition — barely move the pH needle. When TA is low, those same events can swing pH by a full point in either direction, making the water constantly uncomfortable and unpredictable to treat. This is why TA must be fixed first: if you raise your pH now without addressing TA, the next rain shower will pull it right back down.`,
        how: 'Split into two doses, 4 hours apart. Broadcast across the pool surface with the pump running — do not dump the whole amount in at once. It dissolves and circulates slowly, so patience is important here.',
        lookFor: `Retest alkalinity the next day. Then recheck your pH — once TA is stabilized, pH often drifts partway back to normal on its own. Target ${R.ta.monLow}–${R.ta.monHigh} ppm.`,
        note: `Pro tip: Alkalinity Increaser is sold at pool stores as "Alkalinity Up," "Alkalinity Increaser," or "Sodium Bicarbonate." It is identical to grocery store baking soda — the pool store version can cost 3–5× more for the same thing. Arm & Hammer baking soda works perfectly.${isSalt ? '\n\nSalt pool note: Your target alkalinity is 80–100 ppm — slightly tighter than a chlorine pool. Salt generators naturally raise pH over time; keeping TA in this tighter range helps moderate those pH swings.' : ''}`,
      })
    } else if (ta < R.ta.monLow) {
      const dose = ((R.ta.monLow - ta) / 10) * 1.5 * v
      raw.push({
        order: 1,
        urgency: 'soon',
        param: 'alkalinity',
        title: 'Raise alkalinity slightly before adjusting pH',
        chemical: 'Alkalinity Increaser (Baking Soda / Sodium Bicarbonate)',
        amount: oz(dose, 'lbs'),
        why: `Alkalinity at ${ta} ppm is just below the ${R.ta.monLow}–${R.ta.monHigh} ppm ideal. A small alkalinity increaser dose now will make your upcoming pH adjustment more stable and longer-lasting.`,
        how: 'Broadcast across the pool surface with the pump running. Let it circulate for several hours.',
        lookFor: `Retest next day. Target ${R.ta.monLow}–${R.ta.monHigh} ppm.`,
      })
    } else if (ta > R.ta.actionHigh && !shockHandledTA) {
      const phAlsoHigh = ph !== null && ph > 7.6
      if (phAlsoHigh) taHandledPH = true

      // Use a pH-targeted dose per cycle — NEVER try to fix high TA in one shot.
      // The correct approach is the "aeration method": acid drops pH, aeration
      // off-gasses CO₂ and raises pH back, each full cycle lowers TA ~10–20 ppm.
      // Trying to dump enough acid to fix all TA at once would crash pH below 7.0
      // and potentially damage surfaces and equipment.
      const phVal = ph ?? 7.9
      const dose = phAlsoHigh
        ? Math.round(v * (phVal > 7.8 ? 26 : 13))   // standard pH-lowering dose
        : Math.round(v * 20)                           // conservative first dose when pH is in range
      const cyclesEst = Math.ceil((ta - R.ta.monHigh) / 15)  // ~15 ppm per aeration cycle

      raw.push({
        order: 1,
        urgency: 'soon',
        param: 'alkalinity',
        title: phAlsoHigh ? 'Lower alkalinity and pH — repeat cycle method' : 'Lower total alkalinity — aeration cycle method',
        chemical: 'Muriatic Acid (or Dry Acid · pH Down)',
        amount: acidAmount(dose),
        why: phAlsoHigh
          ? `Here is the good news: this is very manageable, it just takes a little patience. Alkalinity at ${ta} ppm is high — and with pH at ${ph} on top of it, the water is extra resistant to change. The most common mistake pool owners make in this situation is dumping in a huge amount of acid trying to fix everything at once. That is how you end up with crashed pH, etched plaster, and a bigger problem than you started with.\n\nThe right move is small, repeated cycles: add a reasonable acid dose, let pH settle, aerate to raise it back, then do it again. Each full cycle quietly chips away at TA by 10–20 ppm — and you never put your pool at risk in the process.${isSalt ? ' Your salt generator actually helps here — it naturally pushes pH back up between cycles, which speeds up the whole process.' : ''}\n\nOne more thing worth checking: if your TA reading came from a test strip, get a drop-test or pool store confirmation before you start. Test strips can read TA 30–60 ppm high — what looks like 240 ppm on a strip might actually be 160–180 ppm on a drop test. That changes how many cycles you need.`
          : `Alkalinity at ${ta} ppm is too high. High TA makes pH stubborn — it resists going up or down, which is frustrating when you are trying to balance the pool. The aeration method (small acid dose + aeration, repeated) is the safe, proven way to bring it down without crashing pH.\n\nIf your reading came from a test strip, it is worth getting a drop-test confirmation — strips can overestimate TA by 30–60 ppm.`,
        how: `Here is exactly what to do — one cycle at a time.\n\nStep 1 — Add muriatic acid (${acidAmount(dose)}) to the deep end in the evening with the pump running. Pour it slowly in a thin stream along the wall — do not dump it in one spot. Wear gloves and eye protection.\n\nStep 2 — Wait 30–60 minutes for it to circulate fully. Then check pH — it should have dropped toward 7.2–7.4, which is what you want.\n\nStep 3 — Aim a return jet toward the water surface and run it for 2–4 hours. This off-gasses CO₂ from the water, which naturally raises pH back toward 7.6–7.8. Every time it rises back up and you add acid again, TA drops another 10–20 ppm in the background. That is how the chemistry works.\n\nRepeat — Each time pH climbs back to ${phAlsoHigh ? (phVal > 7.8 ? '7.8' : '7.6') : '7.6'}+, add the same dose and aerate again. At ${ta} ppm, plan for roughly ${cyclesEst}–${cyclesEst + 2} cycles spread over ${cyclesEst}–${cyclesEst + 2} weeks. You do not need to do them back-to-back — just add acid the next time pH climbs and you are out maintaining the pool anyway.`,
        lookFor: `After each acid addition: retest pH about 1 hour later. Retest TA the following morning. You are looking for pH to settle in the 7.2–7.4 range after each dose, then rise back toward 7.6–7.8 after aeration. TA should tick down 10–20 ppm per complete cycle. Target TA ${R.ta.monLow}–${R.ta.monHigh} ppm.\n\nIf pH crashes below 7.0 after adding acid, you added too much. Raise it back with a small dose of soda ash and go lighter next cycle. Staying patient and keeping doses small is how you get this right.`,
        note: `WHY THE DOSE IS INTENTIONALLY SMALL\n\nWith TA at ${ta} ppm, your pool water has strong buffering — it resists pH change more than normal. The temptation is to add a lot of acid to force it down faster, but that is how you end up with crashed pH below 7.0, which is corrosive to surfaces and equipment and harder to fix than where you started.\n\nThe dose shown here is what you add per cycle — not the total amount to fix everything. Add it, let pH settle, aerate to bring pH back up, then repeat. Each cycle lowers TA 10–20 ppm in the background while pH stays in a safe range the whole time. Your pool stays swimmable throughout, and you are never putting the surfaces at risk.\n\nABOUT DRY ACID (pH Down)\n\nThe dry acid equivalent shown assumes 93% sodium bisulfate. Many store-brand "pH Down" products are only 30–35% — at that concentration you need 2–3× the listed amount. Check the label before using.${isSalt ? '\n\nSalt pool bonus: Your SWG naturally pushes pH upward over time, which actually speeds up the aeration step between cycles. Less manual aeration needed — the generator does some of the work for you.' : ''}`,
      })
    } else if (ta > R.ta.monHigh && !(ta > R.ta.actionHigh && shockHandledTA)) {
      raw.push({
        order: 1,
        urgency: 'routine',
        param: 'alkalinity',
        title: `Alkalinity slightly high — monitor${isSalt ? ', target 80–100 ppm for salt pools' : ''}`,
        chemical: null,
        amount: null,
        why: `Alkalinity at ${ta} ppm is slightly above the ${isSalt ? '80–100' : '80–120'} ppm ideal for ${isSalt ? 'salt' : 'chlorine'} pools. TA drifts down naturally over time — no chemical intervention needed yet.${isSalt ? ' Salt generators raise pH naturally, and tighter alkalinity control (80–100 ppm) helps keep those pH swings manageable.' : ''}`,
        how: `No chemical needed. Do not add any alkalinity increaser until TA drops below ${R.ta.monLow} ppm.`,
        lookFor: `Retest weekly. If it climbs above ${R.ta.actionHigh} ppm and pH becomes difficult to manage, a small muriatic acid dose will bring it down.`,
      })
    }
  } else {
    if (ph !== null && (ph < 7.2 || ph > 7.8)) {
      raw.push({
        order: 1,
        urgency: 'soon',
        param: 'alkalinity',
        title: 'Test alkalinity before adjusting pH',
        chemical: null,
        amount: null,
        why: `We do not have your alkalinity reading, and this matters. Total alkalinity is the buffer that keeps pH stable — it needs to be in range before a pH adjustment will hold. Low pH and low TA almost always appear together.`,
        how: `Pick up an alkalinity test strip or tablet test kit and check your TA. If below ${R.ta.monLow} ppm, treat with alkalinity increaser (baking soda) first. If above ${R.ta.actionHigh} ppm, bring it down with muriatic acid before touching pH.`,
        lookFor: 'Once TA is confirmed in range, retest pH — it may have partially self-corrected.',
        note: `If you have been chasing pH adjustments that never seem to hold, low alkalinity is the most likely culprit.`,
      })
    }
  }

  // ── pH ──────────────────────────────────────────────────────────────────────
  if (ph !== null && !shockHandledPH && !taHandledPH) {
    const taKnownAndOff = ta !== null && (ta < R.ta.actionLow || ta > R.ta.actionHigh)
    const taUnknown = ta === null
    const sequenceNote = taKnownAndOff
      ? 'Complete the alkalinity step above first — once TA is stable, this pH adjustment will hold.'
      : taUnknown
      ? 'If you have not tested alkalinity yet, check it before adding this — low TA makes pH corrections unstable.'
      : isSalt
      ? 'With alkalinity in the salt pool target range (80–100 ppm), this adjustment will hold well.'
      : 'With alkalinity in range, this adjustment will hold well.'

    const saltPHNote = isSalt
      ? '\n\nSalt pool note: Salt generators naturally raise pH over time as a byproduct of electrolysis — this is normal. Regular small acid additions (typically every 1–2 weeks) are expected and are not a sign of a problem. Keeping pH at the lower end of the ideal range (7.2–7.4) gives you more time between adjustments.'
      : ''

    if (ph < 7.0) {
      const dose = Math.round(v * 12)
      raw.push({
        order: 2,
        urgency: 'soon',
        param: 'ph',
        title: 'Raise pH',
        chemical: 'pH Increaser (Soda Ash · Sodium Carbonate · pH Up)',
        amount: oz(dose, 'oz'),
        why: `pH at ${ph} is too low. Beyond the swimmer discomfort — stinging eyes, irritated skin — low pH is actively corrosive. It slowly etches plaster and grout, damages metal fittings, and degrades pool equipment. Getting pH into the 7.2–7.6 range maximizes how long each dose of chlorine lasts. ${sequenceNote}`,
        how: 'Dissolve in a bucket of pool water first, then pour slowly around the perimeter with the pump running.',
        lookFor: 'Retest pH 4–6 hours after adding. Add in increments — it is easier to raise pH a little more than to lower it after overshooting. Target 7.2–7.6.',
        note: saltPHNote || undefined,
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
        why: `pH at ${ph} is just below the ideal 7.2–7.6 range. A small bump up will bring it into range where chlorine lasts longer. ${sequenceNote}`,
        how: 'Dissolve in a bucket of water before adding. Pour slowly around the perimeter with the pump running.',
        lookFor: 'Retest in 4 hours. Target 7.2–7.6.',
        note: saltPHNote || undefined,
      })
    } else if (ph > 7.8) {
      const dose = Math.round(v * 26)
      raw.push({
        order: 2,
        urgency: 'soon',
        param: 'ph',
        title: 'Lower pH',
        chemical: 'Muriatic Acid (or Dry Acid · pH Down)',
        amount: acidAmount(dose),
        why: `pH at ${ph} is too high. At pH 7.8, only about 33% of your chlorine is in its active sanitizing form. Bringing pH down unlocks the full potential of the chlorine${isSalt ? ' your generator is producing' : ' already in your water'}. ${sequenceNote}`,
        how: 'Add to the deep end in the evening with the pump running. Pour slowly in a thin stream along the wall. Wear gloves and eye protection.',
        lookFor: 'Retest the next morning. Target 7.2–7.6.',
        note: saltPHNote || undefined,
      })
    } else if (ph > 7.6) {
      const dose = Math.round(v * 13)
      raw.push({
        order: 2,
        urgency: 'routine',
        param: 'ph',
        title: isSalt ? 'Lower pH — routine for salt pools' : 'Lower pH slightly',
        chemical: 'Muriatic Acid (or Dry Acid · pH Down)',
        amount: acidAmount(dose),
        why: `pH at ${ph} is slightly above the ideal 7.2–7.6 range. Chlorine efficiency starts declining above 7.6 — about 49% of your chlorine is active at 7.5, dropping to 33% by 7.8.${isSalt ? ' Salt generators naturally push pH upward over time — regular small acid additions are a normal part of salt pool maintenance.' : ''}`,
        how: 'Add to the deep end in the evening with the pump running. Pour slowly. Wear gloves.',
        lookFor: 'Retest next day. Target 7.2–7.6.',
        note: saltPHNote || undefined,
      })
    }
  }

  // ── CHLORINE MAINTENANCE (low but not critical — order 3) ───────────────────
  if (fc !== null && fc >= 0.5 && fc < 1) {
    if (isSalt) {
      raw.push({
        order: 3,
        urgency: 'soon',
        param: 'chlorine',
        title: 'Increase your salt generator output',
        chemical: 'Salt Generator — increase output %',
        amount: 'Increase by 10–20% for 2–3 days',
        why: `Free chlorine at ${fc} ppm is below the 1 ppm minimum. Your salt generator should be able to raise this without any chemical additions — simply increasing the output percentage for a few days is usually all that is needed.`,
        how: `Increase your SWG output percentage by 10–20% (e.g., from 50% to 65%). Run the pump for at least 8 hours per day. If you have a boost or superchlorinate mode, run it for one 24-hour cycle.\n\nIf chlorine does not recover within 48 hours at increased output: check your salt level (should be 2700–3400 ppm), inspect the cell for scale buildup, and confirm the cell is still within its service life.`,
        lookFor: 'Retest in 24 hours. Target 1–3 ppm. Once in range, return the SWG to its normal output setting.',
        note: `If chlorine repeatedly drops despite correct SWG output:\n\n1. Salt level — confirm it is in the 2700–3400 ppm range. Low salt reduces cell efficiency dramatically.\n2. Cell scale — calcium deposits on the cell reduce chlorine output. Inspect every 3 months and clean with diluted muriatic acid if needed.\n3. Cell age — most salt cells last 3–5 years. An aging cell produces progressively less chlorine at the same output setting.\n4. Stabilizer (CYA) — salt pools need 70–80 ppm CYA to protect the chlorine the generator produces. If CYA is low, UV burns off chlorine faster than the cell can replace it.`,
      })
    } else {
      const dose = Math.round(v * 13 * (1 - fc))
      const phOff = ph !== null && (ph < 7.2 || ph > 7.8)
      raw.push({
        order: 3,
        urgency: 'soon',
        param: 'chlorine',
        title: 'Add chlorine',
        chemical: 'Liquid Chlorine or Granular Shock',
        amount: chlorineBothAmounts(dose),
        why: `Free chlorine at ${fc} ppm is below the 1 ppm safe minimum. ${phOff ? `By completing the pH adjustment above first, you will get significantly more active sanitizer from the same amount of chlorine you add.` : `With pH in the ideal 7.2–7.6 range, the chlorine you add now will be working at close to full strength.`}`,
        how: 'Add in the evening — UV sunlight destroys chlorine rapidly, and adding during the day means a significant portion is gone before it even finishes circulating. Pour around the perimeter with the pump running.\n\nLiquid chlorine: starts working within minutes. Retest in 1–4 hours.\nGranular shock (cal-hypo): takes 30–60 min to fully dissolve. Pre-dissolve in a bucket of water first — never pour dry granules directly on a vinyl liner. Retest the next morning.',
        lookFor: `Retest in 1–4 hours (liquid chlorine) or the next morning (granular). Target 1–3 ppm. If chlorine drops back to low levels within a day, test your CYA — without adequate stabilizer, UV can burn off most of your chlorine within just a few hours on a sunny day.`,
        note: (() => {
          const caIsHigh = ca !== null && ca > (isSalt ? SALT_RANGES.ca.monHigh : CHLORINE_RANGES.ca.monHigh)
          return `WHICH PRODUCT TO CHOOSE\n\nLiquid chlorine (sodium hypochlorite, 10–12.5%): works within minutes, adds zero calcium hardness and zero CYA. Best choice for regular top-ups — especially if calcium is elevated. Add in the PM, retest in 1–4 hours. Buy fresh; it degrades in storage within a few months.${caIsHigh ? ' ✓ Especially recommended for your pool — calcium is already elevated, and liquid chlorine adds none.' : ''}\n\nGranular shock (cal-hypo 65%): takes 30–60 minutes to fully dissolve. Effective and affordable. Pre-dissolve in a bucket of water first — never pour dry granules directly on a vinyl liner. Add in the evening, retest next morning.\n⚠️ Cal-hypo raises calcium hardness: each pound adds roughly 5–7 ppm calcium per 10,000 gallons. In hard water areas, repeated use compounds already-high calcium over the season.${caIsHigh ? ` Your calcium is currently at ${ca} ppm — liquid chlorine is the smarter choice for regular use.` : ' If calcium climbs above 400 ppm, switch to liquid chlorine for ongoing maintenance.'}\n\nDichlor shock: adds CYA with every dose. Avoid for routine top-ups — it will slowly push CYA above the safe range.\n\nBOTTOM LINE: ${caIsHigh ? 'Your calcium is elevated — liquid chlorine is the right call. No calcium added, fast-acting, and retest in 1–4 hours.' : 'Either works — liquid is faster, granular is more available. Add in the evening, no matter which you choose.'}${cya === null ? '\n\nNote: CYA not tested. If chlorine disappears faster than expected, low stabilizer is almost certainly why.' : ''}`
        })(),
      })
    }
  }

  // ── CYA / STABILIZER (order 4) ──────────────────────────────────────────────
  if (cya !== null) {
    const R_cya = isSalt ? SALT_RANGES.cya : CHLORINE_RANGES.cya
    const cyaIdealRange = isSalt ? '70–80 ppm' : '30–50 ppm'
    const cyaTarget = isSalt ? 75 : 40

    if (cya < R_cya.actionLow) {
      const dose = ((cyaTarget - cya) / 10) * 1.3 * v
      raw.push({
        order: 4,
        urgency: 'soon',
        param: 'cya',
        title: isSalt ? 'Add Cyanuric Acid — salt pools need more' : 'Add Cyanuric Acid (CYA)',
        chemical: 'Cyanuric Acid (Stabilizer)',
        amount: oz(dose, 'lbs'),
        why: isSalt
          ? `CYA at ${cya} ppm is too low for a salt pool. Salt generators produce chlorine continuously, and without enough stabilizer, UV sunlight destroys that chlorine almost as fast as the cell produces it. Salt pools need 70–80 ppm CYA — higher than a chlorine pool — because the SWG runs continuously and needs the protection to keep up with UV demand. Without adequate CYA, the cell works overtime and wears out faster.`
          : `CYA at ${cya} ppm is too low. Cyanuric Acid is your pool's stabilizer — without enough of it, UV sunlight can destroy up to 90% of your pool's chlorine within 2 hours on a clear day. With CYA at the proper level (30–50 ppm), that same chlorine lasts significantly longer — fewer treatments, more consistent protection, lower costs.`,
        how: 'Place stabilizer in an old sock or mesh bag and hang it in front of a return jet, or drop into the skimmer basket with the pump running. Keep the pump running continuously until fully dissolved.',
        lookFor: `CYA takes 5–7 days to fully dissolve and register accurately. Target ${cyaIdealRange}. Once in range, you rarely need to add more within a season — CYA does not evaporate or degrade on its own.`,
      })
    } else if (cya < R_cya.monLow) {
      const dose = ((cyaTarget - cya) / 10) * 1.3 * v
      raw.push({
        order: 4,
        urgency: 'routine',
        param: 'cya',
        title: isSalt ? 'CYA slightly low for salt pool' : 'Add Cyanuric Acid (CYA) — small top-up',
        chemical: 'Cyanuric Acid (Stabilizer)',
        amount: oz(dose, 'lbs'),
        why: isSalt
          ? `CYA at ${cya} ppm is below the 70–80 ppm target for salt pools. With lower stabilizer, UV burns off more of the chlorine your generator produces — the cell has to work harder to keep up, which shortens its life. A top-up now brings you into the optimal range.`
          : `CYA at ${cya} ppm is slightly below the ideal 30–50 ppm range. Without enough stabilizer, UV shortens the lifespan of every chlorine dose you add.`,
        how: 'Add to the skimmer basket or in a mesh bag in front of a return jet. Run the pump continuously. It dissolves slowly.',
        lookFor: `Retest in 5–7 days. Target ${cyaIdealRange}.`,
      })
    } else if (cya > R_cya.actionHigh) {
      raw.push({
        order: 4,
        urgency: 'routine',
        param: 'cya',
        title: 'CYA elevated — confirm reading, then consider dilution',
        chemical: null,
        amount: null,
        why: isSalt
          ? `CYA at ${cya} ppm is above the ${R_cya.actionHigh} ppm level where stabilizer can begin to trap chlorine in an inactive form — the pool can test positive for chlorine and still not sanitize effectively. There is no chemical fix; dilution is the only solution. Before draining, confirm the reading with a drop test or pool store — CYA test strips can be off by 20–40 ppm.`
          : `CYA at ${cya} ppm is above the 100 ppm level where stabilizer starts to meaningfully reduce chlorine effectiveness. Before taking action, confirm with a drop test kit (Taylor K-2006 or similar) or a pool store water analysis — CYA test strips are notoriously inaccurate and can read 20–40 ppm high. If the drop test confirms the reading, a partial drain is the only fix.`,
        how: `First: stop adding any products that contain CYA — this means trichlor tabs and dichlor shock. Switch to liquid chlorine (sodium hypochlorite) or cal-hypo granular shock, both of which are CYA-free. CYA dilutes naturally through splash-out, backwashing, and rainfall — give it a few weeks of liquid-only chlorine before planning a drain.\n\nIf CYA remains above ${R_cya.actionHigh} ppm on a drop test: plan a partial drain on a mild-weather day. Drain 20–30% and refill with fresh water. Retest 24 hours after refilling.`,
        lookFor: `Retest CYA after switching to CYA-free chlorine products for 2–3 weeks. If still elevated on a confirmed drop test, target ${cyaIdealRange} after dilution.`,
        note: isSalt
          ? `CYA TEST STRIP ACCURACY\n\nCYA is measured by a turbidity (cloudiness) method — you mix pool water with a reagent and look for a black dot to disappear. Test strips that estimate CYA by color are significantly less reliable and can read 20–40 ppm higher than actual. Before draining any water, get a drop-test confirmation (Taylor K-2006 or a pool store lab test).\n\nThe most common cause of high CYA in salt pools is using dichlor shock for manual treatments. Each dichlor dose adds CYA, and it accumulates with no way to remove it except dilution. For manual additions in a salt pool, always use liquid chlorine (sodium hypochlorite) — it adds neither CYA nor calcium.`
          : `CYA TEST STRIP ACCURACY\n\nCYA is measured by a turbidity (cloudiness) method — you mix pool water with a reagent and look for a black dot to disappear. Test strips that estimate CYA by color are significantly less reliable and can read 20–40 ppm higher than actual. Before draining any water, get a drop-test confirmation (Taylor K-2006 or a pool store lab test).\n\nThe most common cause of chronically high CYA is regular use of slow-dissolve trichlor tabs. Each tablet adds CYA alongside chlorine, and it accumulates all season. Switching to liquid chlorine stops the accumulation immediately.`,
      })
    } else if (cya > R_cya.monHigh) {
      raw.push({
        order: 4,
        urgency: 'routine',
        param: 'cya',
        title: isSalt ? 'CYA slightly above salt pool target' : 'Cyanuric Acid (CYA) slightly elevated — monitor',
        chemical: null,
        amount: null,
        why: isSalt
          ? `CYA at ${cya} ppm is slightly above the 70–80 ppm target for salt pools. At this level chlorine effectiveness is only mildly affected, but continuing to use dichlor shock will push it higher. Switch to liquid chlorine for any manual additions.`
          : `CYA at ${cya} ppm is slightly above the ideal range but not yet causing problems. It will naturally dilute through splash-out, backwashing, and rain.`,
        how: `No chemical needed. ${isSalt ? 'Avoid dichlor shock — use liquid chlorine for any manual additions.' : 'Hold off on adding more stabilizer or trichlor products until CYA drops below 60 ppm.'}`,
        lookFor: `Retest monthly. If CYA climbs above ${R_cya.actionHigh} ppm, a partial drain will be needed.`,
      })
    }
  }

  // ── CALCIUM HARDNESS (order 5) ───────────────────────────────────────────────
  if (ca !== null) {
    const R_ca = isSalt ? SALT_RANGES.ca : CHLORINE_RANGES.ca
    const caNote = isSalt
      ? '\n\nSalt pool note: Calcium hardness is especially important for salt pools — scale deposits on the salt cell reduce chlorine output and shorten cell life. Keep calcium in the 200–350 ppm range and target pH 7.2–7.4 to minimize scale risk.'
      : ''

    if (ca < R_ca.actionLow) {
      const dose = ((R_ca.monLow - ca) / 10) * 1.25 * v
      raw.push({
        order: 5,
        urgency: 'soon',
        param: 'calcium',
        title: 'Raise calcium hardness',
        chemical: 'Calcium Chloride',
        amount: oz(dose, 'lbs'),
        why: `Calcium at ${ca} ppm is too low. Water chemistry always seeks balance — soft water slowly dissolves calcium from your pool surface, leading to etching and pitting over time.${isSalt ? ' For salt pools, low calcium also accelerates corrosion on the metal components of the salt cell.' : ''}`,
        how: 'Always pre-dissolve calcium chloride in a bucket of water before adding — dry calcium chloride generates heat on contact with water and can damage surfaces. Add in 2–3 smaller doses over several days.',
        lookFor: `Retest 24 hours after each addition. Target ${R_ca.monLow}–${R_ca.monHigh} ppm.`,
        note: caNote || undefined,
      })
    } else if (ca < R_ca.monLow) {
      const dose = ((R_ca.monLow - ca) / 10) * 1.25 * v
      raw.push({
        order: 5,
        urgency: 'routine',
        param: 'calcium',
        title: 'Raise calcium slightly',
        chemical: 'Calcium Chloride',
        amount: oz(dose, 'lbs'),
        why: `Calcium at ${ca} ppm is slightly below the ${R_ca.monLow}–${R_ca.monHigh} ppm ideal. A small top-up now protects your pool surface from slow etching.`,
        how: 'Pre-dissolve in a bucket of water before adding. Add slowly with the pump running.',
        lookFor: `Retest in a few days. Target ${R_ca.monLow}–${R_ca.monHigh} ppm.`,
        note: caNote || undefined,
      })
    } else if (ca > R_ca.actionHigh) {
      raw.push({
        order: 5,
        urgency: 'soon',
        param: 'calcium',
        title: `Calcium high — scale risk${isSalt ? ', cell protection needed' : ''}`,
        chemical: null,
        amount: null,
        why: `Calcium at ${ca} ppm is high enough to cause visible scale buildup.${isSalt ? ' For salt pools this is especially important — calcium scale on the salt cell dramatically reduces chlorine output and shortens cell life.' : ''} There is no chemical that removes calcium from pool water; dilution and sequestering agents are the primary tools.`,
        how: `First priority: add a sequestering agent (Jack's Magic Blue Stuff, SeaKlear Calcium & Scale, or similar phosphonate-based products). These keep calcium in solution so it cannot deposit on surfaces${isSalt ? ' or the salt cell' : ''}. If calcium continues to climb, drain 20–30% and refill. Do not add any calcium chloride.`,
        lookFor: `Retest monthly. Target ${R_ca.monLow}–${R_ca.monHigh} ppm.`,
        note: `In hard water regions, tap water itself can be 300–400 ppm calcium. A sequestering agent used monthly is a more sustainable solution than repeated draining.${caNote}`,
      })
    } else if (ca > R_ca.monHigh) {
      raw.push({
        order: 5,
        urgency: 'routine',
        param: 'calcium',
        title: isSalt ? 'Calcium above salt pool target' : 'Calcium elevated — common in hard water areas',
        chemical: null,
        amount: null,
        why: isSalt
          ? `Calcium at ${ca} ppm is above the 200–350 ppm target for salt pools. At this level scale can begin forming on the salt cell, gradually reducing chlorine output. Keep pH at 7.2–7.4 (lower end of range) to slow scale formation.`
          : `Calcium at ${ca} ppm is above the textbook ideal but in hard water regions this is very common and manageable. At this level with pH and alkalinity in range, scale risk is low.`,
        how: 'No chemical needed. Avoid adding any calcium chloride.',
        lookFor: `Retest monthly. Watch for scale deposits on tile, walls, or equipment.${isSalt ? ' Inspect the salt cell every 3 months — scale on the cell shows as white deposits inside the cell.' : ''}`,
        note: caNote || undefined,
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

    // Timing guidance shown between this step and the next in the treatment plan
    let waitAfter: string | null = null
    if (step.chemical !== null) {
      if (order === 0) {
        // Shock: timing already fully explained in lookFor — no inter-step connector needed
        waitAfter = null
      } else if (order === 1) {
        // Alkalinity adjustment — needs to circulate before pH will hold
        waitAfter = 'Wait 4–6 hours for this to circulate, then retest alkalinity before the next step'
      } else if (order === 2) {
        // pH adjustment — needs to fully mix before it reads accurately
        waitAfter = 'Wait 4–6 hours for pH to stabilize, then retest before proceeding'
      } else if (order === 3) {
        // Chlorine top-up — short wait
        waitAfter = 'Retest in 1–4 hours (liquid chlorine) or next morning (granular)'
      } else if (order === 4) {
        // CYA dissolves very slowly
        waitAfter = 'CYA takes 5–7 days to fully dissolve — do not retest until then'
      } else if (order === 5) {
        // Calcium
        waitAfter = 'Wait 24 hours, then retest before adding more'
      }
    }

    return { ...step, step: i + 1, when, waitAfter }
  })
}

function generateMaintenance(test: TestInput, isSalt: boolean): MaintenanceTip[] {
  const tips: MaintenanceTip[] = []

  tips.push({
    category: 'testing',
    title: 'Test twice a week in warm weather',
    body: 'Check pH and free chlorine at least twice a week during spring and summer. Once a week is usually enough in cooler months.',
  })

  if (isSalt) {
    tips.push({
      category: 'chlorine',
      title: 'Adjust SWG output — don\'t just add chemicals',
      body: 'When chlorine is low, the first response should always be increasing your salt generator output percentage, not reaching for chemicals. Salt pools are designed to be self-sustaining. Only use liquid chlorine as a backup if the SWG cannot keep up.',
    })
    tips.push({
      category: 'chlorine',
      title: 'Salt cell: inspect every 3 months for scale',
      body: 'Calcium scale on the salt cell reduces chlorine output significantly. Every 3 months, inspect the cell — white deposits inside mean it needs cleaning with diluted muriatic acid (1 part acid to 10 parts water, 15–20 minute soak). Keep salt in the 2700–3400 ppm range and calcium below 350 ppm for longest cell life.',
    })
  } else if (test.cya !== null && test.cya > 60) {
    tips.push({
      category: 'chlorine',
      title: `Keep chlorine at 2–3 ppm while CYA is elevated (currently ${test.cya} ppm)`,
      body: 'High CYA reduces how much chlorine is available to sanitize. Until CYA comes down, target the higher end of the range and do not let free chlorine drop below 2 ppm.',
    })
  } else if (test.cya !== null && test.cya < 30) {
    tips.push({
      category: 'chlorine',
      title: `Chlorine burns off fast — CYA is low (${test.cya} ppm)`,
      body: 'Without enough stabilizer, UV destroys chlorine within hours on a sunny day. Test every 1–2 days and add chlorine more frequently until CYA reaches 30–50 ppm.',
    })
  } else {
    const cyaElevated = test.cya !== null && test.cya > 50
    tips.push({
      category: 'chlorine',
      title: 'Weekly chlorine routine',
      body: `Check chlorine twice a week. When it dips below 1 ppm, top it up in the evening — UV destroys chlorine added during the day.\n\nLiquid chlorine (sodium hypochlorite, 10–12.5%): pour around the perimeter, retest in 1–4 hours. Fast, clean, adds zero calcium or CYA.\n\n${cyaElevated ? 'Avoid trichlor tabs right now — CYA is already elevated and tabs add more with every use.' : 'Slow-dissolve trichlor tabs in a floating dispenser (\"pool bobber\"): 2–3 tabs per 10,000 gallons, refill weekly. Convenient for routine maintenance. Note: tabs add a small amount of CYA with each use — check CYA monthly.'}\n\nAlways add in the PM. Never toss tabs directly in the skimmer — concentrated chlorine can damage the pump.`,
    })
  }

  tips.push({
    category: 'shock',
    title: isSalt
      ? 'Boost SWG after heavy rain or parties'
      : 'Shock after heavy rain, parties, or if water looks off',
    body: isSalt
      ? 'After heavy rain, large swimmer loads, or if water looks hazy — run your salt generator on boost/superchlorinate mode for 24 hours. If the pool is visibly cloudy or green, add liquid chlorine as a one-time treatment (do not use cal-hypo — it scales the cell).'
      : 'Shock the pool after significant rainfall, after heavy swimmer loads, if chlorine reads 0, or if the water looks hazy. In peak summer heat, a weekly shock as prevention is a good habit.',
  })

  tips.push({
    category: 'brushing',
    title: 'Brush weekly — algae starts on surfaces, not in the water',
    body: 'Brush walls, floor, steps, and shaded corners once a week. Algae and biofilm establish on surfaces before they are visible in the water — brushing breaks it loose so chlorine can reach it.',
  })

  tips.push({
    category: 'skimmer',
    title: 'Empty the skimmer basket weekly',
    body: 'Check and empty the skimmer basket at least once a week — more often after storms or heavy leaf fall. A clogged skimmer chokes water flow to the pump, reduces filtration, and makes everything downstream less effective. Takes 30 seconds and makes a bigger difference than most chemical adjustments.',
  })

  tips.push({
    category: 'cartridge',
    title: 'Rinse your filter cartridge every 2–4 weeks',
    body: 'This is one of the most overlooked maintenance tasks — and one of the highest-impact ones. A dirty cartridge doesn\'t just reduce flow, it actively recirculates debris and oils back into the pool, causing cloudiness that no amount of chemicals will fix.\n\nRinse with a garden hose (top to bottom between the pleats) every 2–4 weeks during swim season. Deep clean with cartridge cleaner solution every 1–2 months. Replace when pleats are torn, crushed, or no longer hold their shape — typically every 1–3 seasons depending on use.\n\nIf your pool water is persistently cloudy despite correct chemistry, a dirty or worn cartridge is almost always the reason.',
  })

  tips.push({
    category: 'enzyme',
    title: 'Weekly enzymes reduce chlorine demand',
    body: 'Pool enzymes break down oils, sunscreen, and organic buildup that silently consume chlorine — things your filter can\'t catch and chemicals can\'t easily remove. Less organic load means your chlorine goes further and your water stays clearer with less effort.\n\nAdd one capful per 10,000 gallons per week directly to the skimmer while the pump runs. Unlike clarifiers, enzymes actually eliminate the organic matter rather than just clumping it together.\n\nLook for: Natural Chemistry Pool Perfect, BioGuard Optimizer Plus, or any enzyme-based pool product. Leslie\'s Perfect Weekly uses this same enzyme technology combined with a phosphate remover — the enzyme part is genuinely useful, though the phosphate removal isn\'t necessary if your chlorine is well-maintained.\n\nEspecially worthwhile for: pools with heavy bather loads, lots of sunscreen use, or pools in areas with significant tree debris.',
  })

  tips.push({
    category: 'seasonal',
    title: 'In heat above 85°F — chlorine demand roughly doubles',
    body: isSalt
      ? 'Hot water dramatically increases chlorine demand. In heat waves: increase SWG output by 10–15%, run the filter 10–12 hours per day, and retest more frequently. Salt generators can struggle to keep up in extreme heat — monitor closely.'
      : 'Hot water accelerates chlorine consumption and algae growth. During heat waves: keep chlorine at 2–3 ppm, run the filter 10–12 hours per day, and consider shocking weekly even if the water looks clear.',
  })

  tips.push({
    category: 'filter',
    title: 'Run the filter 8–12 hours per day',
    body: isSalt
      ? 'Circulation is critical for salt pools — the SWG only produces chlorine while the pump is running. In summer or during heat waves, run 10–12 hours. If your pool stays cloudy despite correct chemistry, run 24 hours until it clears.'
      : 'Circulation is the foundation of clear water — chemicals cannot do their job without it. In summer, run closer to 12 hours. In cooler months, 6–8 hours is usually enough.',
  })

  if (isSalt) {
    tips.push({
      category: 'filter',
      title: 'Keep salt level 2700–3400 ppm year-round',
      body: 'Salt level affects SWG efficiency more than most people realize. Below 2400 ppm the cell underperforms and may trigger a low-salt alarm. Above 3800 ppm it can corrode equipment and reduce efficiency. Test salt monthly and after significant rainfall or water addition.',
    })
  }

  return tips
}

export function calculateRecommendations(
  test: TestInput,
  volumeGallons: number,
  poolType = 'inground',
): RecommendationResult {
  const v = volumeGallons / 10000
  const isSalt = poolType === 'saltwater' || poolType === 'salt'
  const R = isSalt ? SALT_RANGES : CHLORINE_RANGES
  const recs: Rec[] = []

  const MISSING: Record<string, Rec> = {
    ph: { status: 'unknown', param: 'ph', title: 'pH not tested', desc: 'pH controls chlorine effectiveness and swimmer comfort. If too low (< 7.2) it corrodes equipment and irritates skin. If too high (> 7.8) chlorine becomes ineffective and scale forms.', tags: ['Ideal: 7.2 – 7.6', 'Test soon'] },
    free_chlorine: { status: 'unknown', param: 'free_chlorine', title: 'Free chlorine not tested', desc: "Chlorine is your primary defense against bacteria and algae. Below 1 ppm the water is unsafe to swim in. Above 5 ppm it causes eye and skin irritation.", tags: ['Ideal: 1 – 3 ppm', 'Test separately if possible'] },
    total_alkalinity: { status: 'unknown', param: 'total_alkalinity', title: 'Alkalinity not tested', desc: `Total alkalinity acts as a pH buffer — it keeps pH from swinging wildly. Target ${isSalt ? '80–100' : '80–120'} ppm.`, tags: [`Ideal: ${isSalt ? '80–100' : '80–120'} ppm`, 'Test monthly'] },
    cya: isSalt
      ? { status: 'unknown', param: 'cya', title: 'Cyanuric Acid (CYA) not tested', desc: 'CYA is your stabilizer — it shields chlorine from UV sunlight. Salt pools need 70–80 ppm (higher than chlorine pools) because the SWG runs continuously and UV works against it all day. Without enough CYA the cell has to work overtime and wears out faster.', tags: ['Ideal for salt pools: 70–80 ppm', 'Test monthly'] }
      : { status: 'unknown', param: 'cya', title: 'Cyanuric Acid (CYA) not tested', desc: 'Cyanuric Acid (CYA) is your pool\'s stabilizer — it shields chlorine from being broken down by UV sunlight. Without it, sunlight can destroy 90% of your chlorine within hours. If CYA gets too high (> 80 ppm) it blocks chlorine from sanitizing.', tags: ['Ideal: 30 – 50 ppm', 'Test monthly'] },
    calcium_hardness: { status: 'unknown', param: 'calcium_hardness', title: 'Calcium hardness not tested', desc: `Low calcium causes water to leach calcium from pool surfaces, leading to etching over time. High calcium causes scale deposits.${isSalt ? ' For salt pools, scale on the salt cell reduces chlorine output and shortens cell life.' : ''}`, tags: [`Ideal: ${isSalt ? '200–350' : '200–400'} ppm`, 'Test monthly'] },
  }

  // ── pH ──────────────────────────────────────────────────────────────────────
  if (test.ph === null) { recs.push(MISSING.ph) }
  else if (test.ph < 7.0) {
    const dose = Math.round(v * 12)
    recs.push({ status: 'action', param: 'ph', title: 'Raise your pH', desc: `pH is at ${test.ph} — too low. Add pH Increaser (Soda Ash / pH Up) to protect your equipment and swimmer comfort.`, tags: [`pH Increaser (Soda Ash / pH Up) · ${oz(dose, 'oz')}`, 'Re-test in 4 hours'] })
  } else if (test.ph < 7.2) {
    const dose = Math.round(v * 6)
    recs.push({ status: 'monitor', param: 'ph', title: 'pH slightly low', desc: `pH is at ${test.ph}. A small dose of pH Increaser will bring it into range.`, tags: [`pH Increaser (Soda Ash / pH Up) · ${oz(dose, 'oz')}`, 'Monitor daily'] })
  } else if (test.ph > 7.8) {
    const dose = Math.round(v * 26)
    recs.push({ status: 'action', param: 'ph', title: 'Lower your pH', desc: `pH is at ${test.ph} — too high. Add muriatic acid this evening.${isSalt ? ' Salt generators naturally raise pH — regular small acid additions are normal.' : ''}`, tags: [`Muriatic Acid (or Dry Acid) · ${acidAmount(dose)}`, 'Re-test tomorrow'] })
  } else if (test.ph > 7.6) {
    const dose = Math.round(v * 13)
    recs.push({ status: isSalt ? 'action' : 'monitor', param: 'ph', title: isSalt ? 'Lower pH — routine salt pool maintenance' : 'pH slightly high', desc: `pH is at ${test.ph}. A small acid dose will bring it into range.${isSalt ? ' Salt generators push pH upward over time — regular acid additions are a normal part of salt pool maintenance.' : ''}`, tags: [`Muriatic Acid (or Dry Acid) · ${acidAmount(dose)}`, isSalt ? 'Re-test tomorrow' : 'Monitor daily'] })
  } else if (test.free_chlorine !== null && test.free_chlorine < 0.5 && test.ph > 7.2) {
    recs.push({ status: 'monitor', param: 'ph', title: 'Lower pH to 7.2 before shocking', desc: `pH at ${test.ph} is in range for normal use, but lower it to 7.2 first — at higher pH most of the shock you add is wasted.`, tags: [] })
  } else {
    recs.push({ status: 'good', param: 'ph', title: 'pH is perfect', desc: `pH at ${test.ph} — right in the ideal range of 7.2–7.6.`, tags: [] })
  }

  // ── Free Chlorine ────────────────────────────────────────────────────────────
  if (test.free_chlorine === null) { recs.push(MISSING.free_chlorine) }
  else if (test.free_chlorine < 0.5) {
    if (isSalt) {
      const phNeedsWork = test.ph !== null && test.ph > 7.2
      recs.push({ status: 'action', param: 'chlorine', title: phNeedsWork ? 'Chlorine critically low — lower pH first, then boost SWG' : 'Chlorine critically low — boost your salt generator', desc: phNeedsWork
        ? `Free chlorine at ${test.free_chlorine} ppm — unsafe for swimming. Step 1: lower pH to 7.2. Step 2: set your salt generator to maximum output / boost mode. Low pH makes the chlorine your generator produces 2–3× more effective.`
        : `Free chlorine at ${test.free_chlorine} ppm — unsafe for swimming. Set your salt generator to 100% output / boost mode immediately. If FC does not recover within 48 hours, add liquid chlorine as a backup (do not use cal-hypo).`,
        tags: [] })
    } else {
      const cyaLow  = test.cya === null || test.cya < 20
      const cyaHigh = test.cya !== null && test.cya >= 50
      const dosePerTenK = cyaLow || cyaHigh ? 2 : 1.5
      const dose = Math.round(v * dosePerTenK * 2) / 2
      const phNeedsWork = test.ph !== null && test.ph > 7.2
      if (phNeedsWork) {
        recs.push({ status: 'action', param: 'chlorine', title: 'Chlorine critically low — two steps', desc: `Free chlorine at ${test.free_chlorine} ppm — unsafe for swimming. Step 1: add muriatic acid to bring pH to 7.2. Step 2: shock the pool. At pH ${test.ph}, high pH makes most of the shock ineffective — lower it first and the same dose works 2–3× better.`, tags: [] })
      } else {
        recs.push({ status: 'action', param: 'chlorine', title: 'Chlorine critically low — shock now', desc: `Free chlorine at ${test.free_chlorine} ppm — unsafe for swimming. Shock the pool this evening.`, tags: [] })
      }
    }
  } else if (test.free_chlorine < 1) {
    if (isSalt) {
      recs.push({ status: 'action', param: 'chlorine', title: 'Increase salt generator output', desc: `Free chlorine at ${test.free_chlorine} ppm — below the 1 ppm minimum. Increase your SWG output by 10–20% for 2–3 days. See the treatment plan for details.`, tags: ['Increase SWG output %', 'Re-test in 24 hours'] })
    } else {
      const dose = Math.round(v * 13 * (1 - test.free_chlorine))
      recs.push({ status: 'action', param: 'chlorine', title: 'Add chlorine', desc: `Free chlorine at ${test.free_chlorine} ppm — below the safe minimum of 1 ppm.`, tags: [`Liquid or Granular · ${chlorineBothAmounts(dose)}`, 'Re-test in 4 hours'] })
    }
  } else if (test.free_chlorine > 5) {
    recs.push({ status: 'monitor', param: 'chlorine', title: isSalt ? 'Chlorine high — reduce SWG output' : 'Chlorine high — wait before swimming', desc: isSalt
      ? `Free chlorine at ${test.free_chlorine} ppm. Reduce your SWG output by 10–20% for a few days. Wait until FC is below 5 ppm before swimming.`
      : `Free chlorine at ${test.free_chlorine} ppm. Wait 24–48 hours before swimming. Sunlight will naturally lower it.`,
      tags: [isSalt ? 'Reduce SWG output' : 'No chemicals needed', 'Re-test tomorrow'] })
  } else {
    recs.push({ status: 'good', param: 'chlorine', title: 'Chlorine is in range', desc: `Free chlorine at ${test.free_chlorine} ppm. No action needed.`, tags: [] })
  }

  // ── Total Alkalinity ─────────────────────────────────────────────────────────
  if (test.total_alkalinity === null) { recs.push(MISSING.total_alkalinity) }
  else if (test.total_alkalinity < R.ta.actionLow) {
    const dose = ((R.ta.monLow - test.total_alkalinity) / 10) * 1.5 * v
    recs.push({ status: 'action', param: 'alkalinity', title: 'Raise total alkalinity', desc: `Alkalinity at ${test.total_alkalinity} ppm — too low. Fix this before adjusting pH or the adjustment will not hold.`, tags: [`Alkalinity Increaser (Baking Soda) · ${oz(dose, 'lbs')}`, 'Add in doses', 'Re-test next day'] })
  } else if (test.total_alkalinity < R.ta.monLow) {
    const dose = ((R.ta.monLow - test.total_alkalinity) / 10) * 1.5 * v
    recs.push({ status: 'monitor', param: 'alkalinity', title: 'Alkalinity slightly low', desc: `Alkalinity at ${test.total_alkalinity} ppm. A small baking soda dose will stabilize it.`, tags: [`Alkalinity Increaser (Baking Soda) · ${oz(dose, 'lbs')}`, 'Monitor weekly'] })
  } else if (test.total_alkalinity > R.ta.actionHigh) {
    // Show a per-cycle starting dose, not a total TA-fix dose
    const taStartDose = Math.round(v * 26)
    recs.push({ status: 'action', param: 'alkalinity', title: 'Lower total alkalinity', desc: `Alkalinity at ${test.total_alkalinity} ppm — too high. Use the aeration cycle method: add ${acidAmount(taStartDose)} muriatic acid, run pump, then aim a return jet at the surface for 2–4 hours to raise pH back naturally. Repeat each time pH climbs back up. Each cycle lowers TA 10–20 ppm.${isSalt ? ' Target 80–100 ppm for salt pools.' : ''}`, tags: [`Starting dose: ${acidAmount(taStartDose)} per cycle`, 'Repeat cycle method — see treatment plan'] })
  } else if (test.total_alkalinity > R.ta.monHigh) {
    recs.push({ status: 'monitor', param: 'alkalinity', title: isSalt ? 'Alkalinity above salt pool target' : 'Alkalinity slightly high', desc: `Alkalinity at ${test.total_alkalinity} ppm. Monitor weekly — it will drift down naturally. ${isSalt ? 'Target 80–100 ppm for salt pools.' : ''}`, tags: ['Monitor weekly'] })
  } else {
    recs.push({ status: 'good', param: 'alkalinity', title: 'Alkalinity on target', desc: `Total alkalinity at ${test.total_alkalinity} ppm. Right in range.`, tags: [] })
  }

  // ── CYA ──────────────────────────────────────────────────────────────────────
  const R_cya = isSalt ? SALT_RANGES.cya : CHLORINE_RANGES.cya
  const cyaIdeal = isSalt ? '70–80 ppm' : '30–50 ppm'
  if (test.cya === null) { recs.push(MISSING.cya) }
  else if (test.cya < R_cya.actionLow) {
    const dose = ((isSalt ? 75 : 40) - test.cya) / 10 * 1.3 * v
    recs.push({ status: 'action', param: 'cya', title: isSalt ? 'CYA too low for salt pool' : 'Cyanuric Acid (CYA) too low', desc: isSalt
      ? `CYA at ${test.cya} ppm — too low for a salt pool. Salt generators need 70–80 ppm CYA or UV sunlight burns off chlorine faster than the cell can produce it, forcing the cell to work overtime.`
      : `CYA at ${test.cya} ppm — too low. UV sunlight burns off chlorine within hours without adequate stabilizer.`,
      tags: [`Cyanuric Acid · ${oz(dose, 'lbs')}`, 'Add to skimmer', `Re-test in 5 days`, `Target: ${cyaIdeal}`] })
  } else if (test.cya < R_cya.monLow) {
    const dose = ((isSalt ? 75 : 40) - test.cya) / 10 * 1.3 * v
    recs.push({ status: 'monitor', param: 'cya', title: isSalt ? 'CYA slightly low for salt pool' : 'Cyanuric Acid (CYA) slightly low', desc: isSalt
      ? `CYA at ${test.cya} ppm. Salt pools target 70–80 ppm — a top-up will help your generator work more efficiently.`
      : `CYA at ${test.cya} ppm. A small stabilizer dose will protect chlorine from UV.`,
      tags: [`Cyanuric Acid · ${oz(dose, 'lbs')}`, 'Monitor weekly'] })
  } else if (test.cya > R_cya.actionHigh) {
    recs.push({ status: 'action', param: 'cya', title: 'CYA elevated — verify reading first', desc: `CYA at ${test.cya} ppm. Test strips can read 20–40 ppm high for CYA — confirm with a drop test or pool store before draining. Switch to liquid chlorine now to stop adding more CYA. See treatment plan for details.`, tags: ['Confirm with drop test', 'Switch to liquid chlorine', 'Partial drain if confirmed'] })
  } else if (test.cya > R_cya.monHigh) {
    recs.push({ status: 'monitor', param: 'cya', title: isSalt ? 'CYA slightly above salt pool target' : 'CYA slightly elevated — switch chlorine type', desc: isSalt
      ? `CYA at ${test.cya} ppm is slightly above the 70–80 ppm salt pool target. Avoid dichlor shock — use liquid chlorine for any manual additions and it will dilute naturally.`
      : `CYA at ${test.cya} ppm. Switch to liquid chlorine or cal-hypo shock (both CYA-free) and it will dilute naturally through splash-out and backwashing — no drain needed yet.`,
      tags: ['Switch to liquid chlorine', 'Monitor monthly'] })
  } else {
    recs.push({ status: 'good', param: 'cya', title: 'Cyanuric Acid (CYA) in range', desc: isSalt
      ? `CYA at ${test.cya} ppm — right in the 70–80 ppm target for salt pools. Your generator's chlorine output is well-protected from UV.`
      : `CYA at ${test.cya} ppm. Your chlorine is well-shielded from UV sunlight.`,
      tags: [] })
  }

  // ── Calcium Hardness ─────────────────────────────────────────────────────────
  const R_ca = isSalt ? SALT_RANGES.ca : CHLORINE_RANGES.ca
  if (test.calcium_hardness === null) { recs.push(MISSING.calcium_hardness) }
  else if (test.calcium_hardness < R_ca.actionLow) {
    const dose = ((R_ca.monLow - test.calcium_hardness) / 10) * 1.25 * v
    recs.push({ status: 'action', param: 'calcium', title: 'Raise calcium hardness', desc: `Calcium at ${test.calcium_hardness} ppm — too low. Soft water etches plaster and corrodes equipment.${isSalt ? ' Low calcium also damages the salt cell.' : ''}`, tags: [`Calcium Chloride · ${oz(dose, 'lbs')}`, 'Add in small doses', 'Re-test next day'] })
  } else if (test.calcium_hardness < R_ca.monLow) {
    const dose = ((R_ca.monLow - test.calcium_hardness) / 10) * 1.25 * v
    recs.push({ status: 'monitor', param: 'calcium', title: 'Calcium slightly low', desc: `Calcium at ${test.calcium_hardness} ppm. A small dose will protect your pool surface.`, tags: [`Calcium Chloride · ${oz(dose, 'lbs')}`, 'Monitor monthly'] })
  } else if (test.calcium_hardness > R_ca.actionHigh) {
    recs.push({ status: 'action', param: 'calcium', title: isSalt ? 'Calcium high — cell scale risk' : 'Calcium high — scale risk', desc: `Calcium at ${test.calcium_hardness} ppm.${isSalt ? ' Calcium scale on the salt cell reduces chlorine output and shortens cell life.' : ''} Use a sequestering agent to keep calcium in solution. In hard water areas, draining helps but the replacement water refills much of what you remove — sequestering is the more practical long-term fix.`, tags: [] })
  } else if (test.calcium_hardness > R_ca.monHigh) {
    recs.push({ status: 'monitor', param: 'calcium', title: isSalt ? 'Calcium above salt pool target' : 'Calcium elevated — common in hard water', desc: isSalt
      ? `Calcium at ${test.calcium_hardness} ppm is above the 200–350 ppm salt pool target. Keep pH at 7.2–7.4 to slow scale formation on the cell. Inspect cell every 3 months.`
      : `Calcium at ${test.calcium_hardness} ppm. In hard water regions this is expected. Keep pH at the lower end (7.2–7.4) to reduce scale risk.`,
      tags: ['Monitor monthly'] })
  } else {
    recs.push({ status: 'good', param: 'calcium', title: 'Calcium hardness good', desc: `Calcium at ${test.calcium_hardness} ppm. Your pool surface and equipment are well protected.${isSalt ? ' Salt cell scale risk is low at this level.' : ''}`, tags: [] })
  }

  // ── Salt Level (salt pools only) ─────────────────────────────────────────────
  if (isSalt) {
    if (test.salt === null) {
      recs.push({ status: 'unknown', param: 'salt', title: 'Salt level not tested', desc: 'Salt level directly controls your generator\'s chlorine output. Too low and the cell underperforms or shuts off. Too high and equipment can corrode. Test monthly and after adding water.', tags: ['Ideal: 2700–3400 ppm', 'Test monthly'] })
    } else if (test.salt < 2400) {
      const saltNeeded = Math.round(((2700 - test.salt) / 1000) * (volumeGallons / 1000) * 8.34)
      recs.push({ status: 'action', param: 'salt', title: 'Salt level too low — add pool salt', desc: `Salt at ${test.salt} ppm is below the minimum for most salt generators. Your SWG is likely underperforming or showing a low-salt alarm. Add approximately ${saltNeeded} lbs of pool-grade salt.`, tags: [`Pool Salt · ~${saltNeeded} lbs`, 'Re-test after 24 hours'] })
    } else if (test.salt < 2700) {
      const saltNeeded = Math.round(((2700 - test.salt) / 1000) * (volumeGallons / 1000) * 8.34)
      recs.push({ status: 'monitor', param: 'salt', title: 'Salt slightly low', desc: `Salt at ${test.salt} ppm is slightly below the 2700–3400 ppm ideal. A small top-up will keep the generator running at full efficiency.`, tags: [`Pool Salt · ~${saltNeeded} lbs`, 'Monitor monthly'] })
    } else if (test.salt > 3800) {
      recs.push({ status: 'action', param: 'salt', title: 'Salt too high — dilute', desc: `Salt at ${test.salt} ppm is too high. Excessive salt can cause corrosion on pool equipment and reduces SWG efficiency. Drain 10–20% of the pool and refill with fresh water.`, tags: ['Partial drain & refill', 'Re-test after 24 hours'] })
    } else if (test.salt > 3400) {
      recs.push({ status: 'monitor', param: 'salt', title: 'Salt slightly elevated', desc: `Salt at ${test.salt} ppm is slightly above the 2700–3400 ppm ideal. Normal evaporation and splash-out will bring it down over time. No action needed unless it climbs above 3800 ppm.`, tags: ['Monitor monthly'] })
    } else {
      recs.push({ status: 'good', param: 'salt', title: 'Salt level is perfect', desc: `Salt at ${test.salt} ppm — right in the 2700–3400 ppm ideal range. Your generator has everything it needs to run at full efficiency.`, tags: [] })
    }
  }

  const actionCount = recs.filter(r => r.status === 'action').length
  const monitorCount = recs.filter(r => r.status === 'monitor').length
  // Unknown (untested) params reduce score.
  // For salt pools, salt itself is required — not optional.
  // For non-salt pools, the salt field is excluded from penalty.
  const unknownCount = recs.filter(r => r.status === 'unknown' && (isSalt || r.param !== 'salt')).length
  const health_score = Math.max(10, 100 - actionCount * 18 - monitorCount * 6 - unknownCount * 8)

  const treatment_plan = buildTreatmentPlan(test, v, isSalt)
  const maintenance = generateMaintenance(test, isSalt)

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
