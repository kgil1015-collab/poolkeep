// Apple requires subscriptions that unlock in-app features to go through
// In-App Purchase (Guideline 3.1.1) — Stripe checkout must not be reachable
// from the iOS build. This wraps RevenueCat (a StoreKit wrapper) so the rest
// of the app can check `subscription_status` the same way regardless of
// whether Stripe or the App Store originated the entitlement — the
// RevenueCat webhook (app/api/revenuecat/webhook) writes the same
// `profiles.subscription_status` column the Stripe webhook does.

import { Capacitor } from '@capacitor/core'
import { Purchases, LOG_LEVEL, type PurchasesOffering, type PurchasesPackage, type CustomerInfo } from '@revenuecat/purchases-capacitor'

export function isIOSNative(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'
}

let configured = false

export async function configurePurchases(appUserId: string) {
  if (!isIOSNative() || configured) return
  const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY
  if (!apiKey) {
    console.error('NEXT_PUBLIC_REVENUECAT_IOS_KEY is not set — cannot configure in-app purchases')
    return
  }
  await Purchases.setLogLevel({ level: LOG_LEVEL.WARN })
  await Purchases.configure({ apiKey, appUserID: appUserId })
  configured = true
}

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  const offerings = await Purchases.getOfferings()
  return offerings.current ?? null
}

export async function purchase(pkg: PurchasesPackage) {
  const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg })
  return customerInfo
}

// The founding-member deal ($60 once, then $4.99/mo for life) can't be a single
// App Store product — Apple's subscription pricing only discounts the
// recurring price, it can't stack a separate one-time fee on top of a
// standard-price subscription starting from day one. So it's built as two
// App Store Connect products: a one-time non-consumable fee
// (app.poolkeep.founding.fee) plus a $4.99/mo subscription
// (app.poolkeep.pro.founding), purchased back-to-back.
const FOUNDING_FEE_PRODUCT_ID = 'app.poolkeep.founding.fee'
const FOUNDING_SUBSCRIPTION_PRODUCT_ID = 'app.poolkeep.pro.founding'

export function isFoundingPackage(pkg: PurchasesPackage): boolean {
  return pkg.product.identifier === FOUNDING_SUBSCRIPTION_PRODUCT_ID
}

async function purchaseOneTimeProduct(productId: string): Promise<void> {
  const { products } = await Purchases.getProducts({ productIdentifiers: [productId] })
  const product = products[0]
  if (!product) throw new Error(`Product ${productId} not found — check it's set up in RevenueCat.`)
  await Purchases.purchaseStoreProduct({ product })
}

// Used to display the one-time founding fee's real store price before purchase —
// it's a separate product from the subscription package, so its price doesn't
// otherwise appear anywhere in the offering UI.
export async function getFoundingFeePriceString(): Promise<string | null> {
  const { products } = await Purchases.getProducts({ productIdentifiers: [FOUNDING_FEE_PRODUCT_ID] })
  return products[0]?.priceString ?? null
}

// Charges the one-time founding fee first — only starts the discounted
// subscription if the fee purchase actually succeeds, so nobody ends up
// with the discounted rate without having paid the fee.
export async function purchaseFoundingBundle(pkg: PurchasesPackage): Promise<CustomerInfo> {
  await purchaseOneTimeProduct(FOUNDING_FEE_PRODUCT_ID)
  return purchase(pkg)
}

export async function restore() {
  const { customerInfo } = await Purchases.restorePurchases()
  return customerInfo
}

export function isEntitled(customerInfo: CustomerInfo): boolean {
  return Object.prototype.hasOwnProperty.call(customerInfo.entitlements.active, 'pro')
}
