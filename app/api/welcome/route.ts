import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export const runtime = 'nodejs'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.FROM_EMAIL ?? 'PoolKeep <onboarding@resend.dev>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.poolkeep.app'

function welcomeEmail(name: string): string {
  const firstName = name.split(' ')[0] || 'there'
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0F6FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.07);">

    <!-- Header -->
    <div style="background:#003D5C;padding:36px 28px 32px;">
      <p style="margin:0 0 16px;color:rgba(255,255,255,0.5);font-size:13px;font-weight:300;letter-spacing:-.01em;">
        Pool<strong style="color:white;font-weight:800;">Keep</strong>
      </p>
      <h1 style="margin:0 0 8px;color:#fff;font-size:26px;font-weight:700;line-height:1.2;">
        Welcome, ${firstName}! 👋
      </h1>
      <p style="margin:0;color:rgba(255,255,255,0.6);font-size:14px;line-height:1.5;">
        Your account is ready. Let's get your pool dialed in.
      </p>
    </div>

    <!-- Body -->
    <div style="padding:28px;">
      <p style="margin:0 0 20px;color:#4A6A7C;font-size:15px;line-height:1.6;">
        First, <strong style="color:#003D5C;">check your inbox</strong> for a confirmation email and click the link to activate your account.
        Once confirmed, you're ready to log your first water test.
      </p>

      <!-- Steps -->
      <div style="background:#F0F6FA;border-radius:14px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 14px;color:#003D5C;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;">What to do first</p>
        ${[
          ['1', 'Confirm your email', 'Click the link in the confirmation email we just sent.'],
          ['2', 'Set up your pool', 'Enter your pool type and size so we can calculate exact doses.'],
          ['3', 'Log your first test', 'Enter your water readings and get your health score instantly.'],
        ].map(([num, title, desc]) => `
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;">
          <div style="width:24px;height:24px;border-radius:50%;background:#0078B8;color:white;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;line-height:24px;text-align:center;">${num}</div>
          <div>
            <p style="margin:0 0 2px;color:#1A2E3B;font-size:13px;font-weight:600;">${title}</p>
            <p style="margin:0;color:#4A6A7C;font-size:12px;line-height:1.5;">${desc}</p>
          </div>
        </div>`).join('')}
      </div>

      <!-- CTA -->
      <a href="${APP_URL}/dashboard" style="display:block;text-align:center;background:#00E0B0;color:#003D5C;font-weight:700;font-size:14px;padding:15px 28px;border-radius:12px;text-decoration:none;margin-bottom:20px;">
        Open PoolKeep →
      </a>

      <p style="margin:0;color:#8AAABB;font-size:12px;line-height:1.5;text-align:center;">
        Questions? Reply to this email or reach us at
        <a href="mailto:kgil1015@aol.com" style="color:#0078B8;text-decoration:none;">kgil1015@aol.com</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  if (!RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email not configured' }, { status: 500 })
  }

  let email: string, name: string
  try {
    const body = await req.json()
    email = body.email
    name = body.name || 'there'
    if (!email || !email.includes('@')) throw new Error('invalid email')
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const resend = new Resend(RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Welcome to PoolKeep — your pool dashboard is ready',
    html: welcomeEmail(name),
  })

  if (error) {
    console.error('Welcome email error:', error)
    return NextResponse.json({ error: 'Send failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
