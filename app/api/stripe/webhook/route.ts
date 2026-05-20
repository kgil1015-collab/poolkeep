import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function upsertSubscription(sub: Stripe.Subscription) {
  const userId = sub.metadata?.supabase_user_id
  if (!userId) return

  await adminClient.from('profiles').upsert({
    id: userId,
    stripe_subscription_id: sub.id,
    subscription_status: sub.status,
    plan: (sub.items.data[0]?.price.recurring?.interval === 'year') ? 'annual' : 'monthly',
    current_period_end: new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000).toISOString(),
  })
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode === 'subscription' && session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string)
        // Attach user metadata if not set
        if (!sub.metadata?.supabase_user_id && session.customer) {
          const customer = await stripe.customers.retrieve(session.customer as string) as Stripe.Customer
          const userId = customer.metadata?.supabase_user_id
          if (userId) {
            await stripe.subscriptions.update(sub.id, { metadata: { supabase_user_id: userId } })
            sub.metadata.supabase_user_id = userId
          }
        }
        await upsertSubscription(sub)
      }
      break
    }

    case 'customer.subscription.updated': {
      await upsertSubscription(event.data.object as Stripe.Subscription)
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.supabase_user_id
      if (userId) {
        await adminClient.from('profiles').upsert({
          id: userId,
          stripe_subscription_id: null,
          subscription_status: 'canceled',
          plan: null,
          current_period_end: null,
        })
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
