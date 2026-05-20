import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export const runtime = 'nodejs'

const CRON_SECRET = process.env.CRON_SECRET
const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.FROM_EMAIL ?? 'PoolKeep <hello@poolkeep.app>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://poolkeep.app'

function reminderEmail(poolName: string, daysSince: number): string {
  const daysText = daysSince === 1 ? '1 day' : `${daysSince} days`
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0F6FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.07);">
    <div style="background:#003D5C;padding:32px 28px 28px;">
      <p style="margin:0 0 4px;color:rgba(255,255,255,0.5);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;">Pool<strong style="color:white;font-weight:800">Keep</strong></p>
      <h1 style="margin:12px 0 0;color:#fff;font-size:22px;font-weight:700;line-height:1.2;">${poolName} is due<br>for a water test</h1>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 16px;color:#4A6A7C;font-size:15px;line-height:1.6;">
        It's been <strong style="color:#003D5C;">${daysText}</strong> since your last water test.
        Regular testing keeps your pool safe, balanced, and easy to maintain.
      </p>
      <p style="margin:0 0 24px;color:#4A6A7C;font-size:14px;line-height:1.6;">
        A quick 5-minute test now can prevent hours of corrective work later — and keeps swimmers safe.
      </p>
      <a href="${APP_URL}/log" style="display:inline-block;background:#0078B8;color:#fff;font-weight:700;font-size:14px;padding:14px 28px;border-radius:12px;text-decoration:none;">
        Log a Water Test →
      </a>
      <p style="margin:24px 0 0;color:#8AAABB;font-size:12px;line-height:1.5;">
        You're receiving this because you set up a test reminder in PoolKeep.
        To change or turn off reminders, open the app and tap your pool dashboard.
      </p>
    </div>
  </div>
</body>
</html>`
}

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const resend = new Resend(RESEND_API_KEY)

  // Fetch all pools with reminders enabled
  const { data: pools, error } = await supabase
    .from('pools')
    .select('id, name, user_id, remind_after_days, last_reminder_sent_at')
    .not('remind_after_days', 'is', null)

  if (error) {
    console.error('Failed to fetch pools:', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  const now = Date.now()
  const results: { pool: string; action: string }[] = []

  for (const pool of pools ?? []) {
    const intervalMs = (pool.remind_after_days as number) * 86400000

    // Check last reminder sent — don't re-send within the same interval
    if (pool.last_reminder_sent_at) {
      const msSinceReminder = now - new Date(pool.last_reminder_sent_at as string).getTime()
      if (msSinceReminder < intervalMs) {
        results.push({ pool: pool.name as string, action: 'skipped (reminder sent recently)' })
        continue
      }
    }

    // Get latest test for this pool
    const { data: tests } = await supabase
      .from('test_results')
      .select('tested_at')
      .eq('pool_id', pool.id)
      .order('tested_at', { ascending: false })
      .limit(1)

    const latestTestedAt = tests?.[0]?.tested_at
    const daysSinceTest = latestTestedAt
      ? Math.floor((now - new Date(latestTestedAt as string).getTime()) / 86400000)
      : 9999

    if (daysSinceTest < (pool.remind_after_days as number)) {
      results.push({ pool: pool.name as string, action: 'skipped (tested recently)' })
      continue
    }

    // Get user email from auth
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(pool.user_id as string)
    if (userError || !user?.email) {
      results.push({ pool: pool.name as string, action: 'skipped (no email)' })
      continue
    }

    // Send reminder
    const { error: sendError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: user.email,
      subject: `${pool.name as string} needs a water test`,
      html: reminderEmail(pool.name as string, daysSinceTest),
    })

    if (sendError) {
      console.error('Resend error for pool', pool.id, sendError)
      results.push({ pool: pool.name as string, action: 'send failed' })
      continue
    }

    // Record that we sent a reminder
    await supabase
      .from('pools')
      .update({ last_reminder_sent_at: new Date().toISOString() })
      .eq('id', pool.id)

    results.push({ pool: pool.name as string, action: `reminded (${daysSinceTest}d since last test)` })
  }

  return NextResponse.json({ ok: true, processed: results.length, results })
}
