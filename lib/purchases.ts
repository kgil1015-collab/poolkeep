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

export async function restore() {
  const { customerInfo } = await Purchases.restorePurchases()
  return customerInfo
}

export function isEntitled(customerInfo: CustomerInfo): boolean {
  return Object.prototype.hasOwnProperty.call(customerInfo.entitlements.active, 'pro')
}
