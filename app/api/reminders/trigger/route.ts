import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export const runtime = 'nodejs'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.FROM_EMAIL ?? 'PoolKeep <hello@poolkeep.app>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://poolkeep.app'

function reminderEmail(poolName: string, daysSince: number): string {
  const daysText = daysSince === 1 ? '1 day' : daysSince >= 9999 ? 'a while' : `${daysSince} days`
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

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  if (!RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email not configured' }, { status: 500 })
  }

  const { poolId } = await req.json()
  if (!poolId) return NextResponse.json({ error: 'Missing poolId' }, { status: 400 })

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Verify the pool belongs to this user
  const { data: pool } = await adminClient
    .from('pools')
    .select('id, name, user_id')
    .eq('id', poolId)
    .eq('user_id', user.id)
    .single()

  if (!pool) return NextResponse.json({ error: 'Pool not found' }, { status: 404 })

  // Get days since last test
  const { data: tests } = await adminClient
    .from('test_results')
    .select('created_at')
    .eq('pool_id', poolId)
    .order('created_at', { ascending: false })
    .limit(1)

  const daysSinceTest = tests?.[0]?.created_at
    ? Math.floor((Date.now() - new Date(tests[0].created_at as string).getTime()) / 86400000)
    : 9999

  const resend = new Resend(RESEND_API_KEY)
  const { error: sendError } = await resend.emails.send({
    from: FROM_EMAIL,
    to: user.email!,
    subject: `${pool.name as string} needs a water test`,
    html: reminderEmail(pool.name as string, daysSinceTest),
  })

  if (sendError) {
    console.error('Resend error:', sendError)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
