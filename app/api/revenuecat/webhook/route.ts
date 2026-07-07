import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Entitlement is granted or renewed
const ACTIVE_TYPES = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE', 'NON_RENEWING_PURCHASE'])
// Entitlement has actually lapsed (CANCELLATION alone just turns off auto-renew —
// the entitlement stays active until EXPIRATION fires at the paid-through date)
const CANCELED_TYPES = new Set(['EXPIRATION'])

function planFromProductId(productId: string): string {
  if (productId && productId === process.env.RC_PRODUCT_ANNUAL) return 'annual'
  if (productId && productId === process.env.RC_PRODUCT_FOUNDING) return 'founding'
  return 'monthly'
}

// RevenueCat webhook — configure the same secret as the "Authorization header
// value" in the RevenueCat dashboard (Project Settings > Integrations > Webhooks).
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.REVENUECAT_WEBHOOK_SECRET || auth !== `Bearer ${process.env.REVENUECAT_WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const event = body?.event
  if (!event?.app_user_id || !event?.type) {
    return NextResponse.json({ received: true })
  }

  const userId = event.app_user_id as string
  const type = event.type as string

  if (ACTIVE_TYPES.has(type)) {
    await adminClient.from('profiles').upsert({
      id: userId,
      subscription_status: 'active',
      plan: planFromProductId(event.product_id ?? ''),
      current_period_end: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null,
    })
  } else if (CANCELED_TYPES.has(type)) {
    await adminClient.from('profiles').upsert({
      id: userId,
      subscription_status: 'canceled',
      plan: null,
      current_period_end: null,
    })
  } else if (type === 'BILLING_ISSUE') {
    await adminClient.from('profiles').upsert({ id: userId, subscription_status: 'past_due' })
  }

  return NextResponse.json({ received: true })
}
