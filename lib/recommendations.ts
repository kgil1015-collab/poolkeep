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

export type RecommendationResult = {
  health_score: number
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

export function calculateRecommendations(test: TestInput, volumeGallons: number): RecommendationResult {
  const v = volumeGallons / 10000
  const recs: Rec[] = []

  const MISSING: Record<string, Rec> = {
    ph: { status: 'unknown', param: 'ph', title: 'pH not tested', desc: 'pH controls chlorine effectiveness and swimmer comfort. If too low (< 7.2) it corrodes equipment and irritates skin. If too high (> 7.8) chlorine becomes ineffective and scale forms. Test with your next strip.', tags: ['Ideal: 7.2 – 7.6', 'Test soon'] },
    free_chlorine: { status: 'unknown', param: 'free_chlorine', title: 'Free chlorine not tested', desc: 'Chlorine is your primary defense against bacteria and algae. Below 1 ppm the water is unsafe to swim in. Above 5 ppm it causes eye and skin irritation. If your strips don\'t include it, consider adding a separate chlorine test.', tags: ['Ideal: 1 – 3 ppm', 'Test separately if possible'] },
    total_alkalinity: { status: 'unknown', param: 'total_alkalinity', title: 'Alkalinity not tested', desc: 'Total alkalinity acts as a pH buffer. When low (< 80 ppm) pH swings wildly with every rain or chemical addition. When high (> 120 ppm) pH becomes difficult to adjust and scale can form.', tags: ['Ideal: 80 – 120 ppm', 'Test monthly'] },
    cya: { status: 'unknown', param: 'cya', title: 'CYA not tested', desc: 'Stabilizer protects chlorine from UV — without it, sunlight destroys chlorine within hours. If CYA is too high (> 80 ppm) it blocks chlorine from sanitizing effectively, a condition called "chlorine lock."', tags: ['Ideal: 30 – 50 ppm', 'Test monthly'] },
    calcium_hardness: { status: 'unknown', param: 'calcium_hardness', title: 'Calcium hardness not tested', desc: 'Low calcium (< 200 ppm) causes water to leach calcium from your pool surface, leading to etching and pitting. High calcium (> 400 ppm) causes white scale on walls, tiles, and equipment.', tags: ['Ideal: 200 – 400 ppm', 'Test monthly'] },
  }

  // pH — ideal 7.2–7.6
  if (test.ph === null) { recs.push(MISSING.ph) }
  else if (test.ph < 7.0) {
    const dose = Math.round(v * 12)
    recs.push({ status: 'action', param: 'ph', title: 'Raise your pH', desc: `pH is at ${test.ph} — too low. Add soda ash to protect your equipment and swimmer comfort.`, tags: [`Soda Ash · ${oz(dose, 'oz')}`, 'Re-test in 4 hours'] })
  } else if (test.ph < 7.2) {
    const dose = Math.round(v * 6)
    recs.push({ status: 'monitor', param: 'ph', title: 'pH slightly low', desc: `pH is at ${test.ph}. A small dose of soda ash will bring it into range.`, tags: [`Soda Ash · ${oz(dose, 'oz')}`, 'Monitor daily'] })
  } else if (test.ph > 7.8) {
    const dose = Math.round(v * 26)
    recs.push({ status: 'action', param: 'ph', title: 'Lower your pH', desc: `pH is at ${test.ph} — too high. Add muriatic acid this evening after sunset.`, tags: [`Muriatic Acid · ${oz(dose, 'oz')}`, 'Re-test tomorrow'] })
  } else if (test.ph > 7.6) {
    const dose = Math.round(v * 13)
    recs.push({ status: 'monitor', param: 'ph', title: 'pH slightly high', desc: `pH is at ${test.ph}. A small dose of muriatic acid will bring it into range.`, tags: [`Muriatic Acid · ${oz(dose, 'oz')}`, 'Monitor daily'] })
  } else {
    recs.push({ status: 'good', param: 'ph', title: 'pH is perfect', desc: `pH at ${test.ph} — right in the ideal range of 7.2–7.6.`, tags: [] })
  }

  // Free Chlorine — ideal 1–3 ppm
  if (test.free_chlorine === null) { recs.push(MISSING.free_chlorine) }
  else if (test.free_chlorine < 0.5) {
    const dose = Math.round(v * 2 * Math.max(1, 3 - test.free_chlorine))
    recs.push({ status: 'action', param: 'chlorine', title: 'Chlorine critically low', desc: `Free chlorine at ${test.free_chlorine} ppm — unsafe for swimming. Shock the pool immediately.`, tags: [`Shock · ${oz(dose, 'lbs')}`, 'Do not swim until 1+ ppm', 'Re-test in 2 hours'] })
  } else if (test.free_chlorine < 1) {
    const dose = Math.round(v * 13 * (1 - test.free_chlorine))
    recs.push({ status: 'action', param: 'chlorine', title: 'Add chlorine', desc: `Free chlorine at ${test.free_chlorine} ppm — below the safe minimum of 1 ppm.`, tags: [`Liquid Chlorine · ${oz(dose, 'oz')}`, 'Re-test in 4 hours'] })
  } else if (test.free_chlorine > 5) {
    recs.push({ status: 'monitor', param: 'chlorine', title: 'Chlorine high — wait', desc: `Free chlorine at ${test.free_chlorine} ppm. Wait 24–48 hours before swimming. Sunlight will naturally lower it.`, tags: ['No chemicals needed', 'Re-test tomorrow'] })
  } else {
    recs.push({ status: 'good', param: 'chlorine', title: 'Chlorine is perfect', desc: `Free chlorine at ${test.free_chlorine} ppm. No action needed. Check again in 3 days.`, tags: [] })
  }

  // Total Alkalinity — ideal 80–120 ppm
  if (test.total_alkalinity === null) { recs.push(MISSING.total_alkalinity) }
  else if (test.total_alkalinity < 60) {
    const dose = ((80 - test.total_alkalinity) / 10) * 1.5 * v
    recs.push({ status: 'action', param: 'alkalinity', title: 'Raise total alkalinity', desc: `Alkalinity at ${test.total_alkalinity} ppm — too low. This causes pH to swing unpredictably.`, tags: [`Baking Soda · ${oz(dose, 'lbs')}`, 'Add in small doses', 'Re-test next day'] })
  } else if (test.total_alkalinity < 80) {
    const dose = ((80 - test.total_alkalinity) / 10) * 1.5 * v
    recs.push({ status: 'monitor', param: 'alkalinity', title: 'Alkalinity slightly low', desc: `Alkalinity at ${test.total_alkalinity} ppm. A small baking soda dose will stabilize it.`, tags: [`Baking Soda · ${oz(dose, 'lbs')}`, 'Monitor weekly'] })
  } else if (test.total_alkalinity > 140) {
    const dose = Math.round(v * 26 * ((test.total_alkalinity - 120) / 10))
    recs.push({ status: 'action', param: 'alkalinity', title: 'Lower total alkalinity', desc: `Alkalinity at ${test.total_alkalinity} ppm — too high. Use muriatic acid and aerate afterward.`, tags: [`Muriatic Acid · ${oz(dose, 'oz')}`, 'Aerate after adding', 'Re-test next day'] })
  } else if (test.total_alkalinity > 120) {
    recs.push({ status: 'monitor', param: 'alkalinity', title: 'Alkalinity slightly high', desc: `Alkalinity at ${test.total_alkalinity} ppm. Monitor weekly — it will drift down naturally.`, tags: ['Monitor weekly'] })
  } else {
    recs.push({ status: 'good', param: 'alkalinity', title: 'Alkalinity on target', desc: `Total alkalinity at ${test.total_alkalinity} ppm. Right in range.`, tags: [] })
  }

  // CYA — ideal 30–50 ppm
  if (test.cya === null) { recs.push(MISSING.cya) }
  else if (test.cya < 20) {
    const dose = ((40 - test.cya) / 10) * 1.3 * v
    recs.push({ status: 'action', param: 'cya', title: 'Add stabilizer', desc: `CYA at ${test.cya} ppm — too low. Chlorine is burning off fast in sunlight without stabilizer.`, tags: [`Stabilizer · ${oz(dose, 'lbs')}`, 'Add to skimmer', 'Re-test in 5 days'] })
  } else if (test.cya < 30) {
    const dose = ((40 - test.cya) / 10) * 1.3 * v
    recs.push({ status: 'monitor', param: 'cya', title: 'CYA slightly low', desc: `CYA at ${test.cya} ppm. Add a small dose of stabilizer to protect your chlorine from sunlight.`, tags: [`Stabilizer · ${oz(dose, 'lbs')}`, 'Monitor weekly'] })
  } else if (test.cya > 80) {
    recs.push({ status: 'action', param: 'cya', title: 'CYA too high — dilute', desc: `CYA at ${test.cya} ppm. High CYA blocks chlorine from working. Drain and refill 20–30% of the pool.`, tags: ['Partial drain & refill', 'No chemical fix', 'Re-test after refill'] })
  } else if (test.cya > 60) {
    recs.push({ status: 'monitor', param: 'cya', title: 'CYA slightly elevated', desc: `CYA at ${test.cya} ppm. Dilute by replacing ~10% of pool water over the next week.`, tags: ['Monitor weekly'] })
  } else {
    recs.push({ status: 'good', param: 'cya', title: 'Stabilizer in range', desc: `CYA at ${test.cya} ppm. Your chlorine is well-protected from sunlight.`, tags: [] })
  }

  // Calcium Hardness — ideal 200–400 ppm
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

  // Health score
  const actionCount = recs.filter(r => r.status === 'action').length
  const monitorCount = recs.filter(r => r.status === 'monitor').length
  const health_score = Math.max(10, 100 - actionCount * 18 - monitorCount * 6)

  return {
    health_score,
    unknown: recs.filter(r => r.status === 'unknown'),
    action: recs.filter(r => r.status === 'action'),
    monitor: recs.filter(r => r.status === 'monitor'),
    good: recs.filter(r => r.status === 'good'),
  }
}
