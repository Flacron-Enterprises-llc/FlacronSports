// Creates or finds FlacronSport's own Stripe test catalog. Safe to run again:
// objects are matched by metadata app_id, and other apps' objects are never changed.
// Usage: STRIPE_SECRET_KEY=rk_test_... node scripts/stripe-catalog.mjs
import Stripe from "stripe"

const APP_ID = "flacron-sport"
const key = process.env.STRIPE_SECRET_KEY ?? ""
if (!/^(sk|rk)_test_/.test(key)) throw new Error("A test mode key is required")

const stripe = new Stripe(key)
const metadata = { app_id: APP_ID, application_id: APP_ID }

const PLANS = [
  { sku: "plus", name: "FlacronSport Plus", prices: [["monthly", 699, "month"], ["annual", 5999, "year"]] },
  { sku: "premium", name: "FlacronSport Premium", prices: [["monthly", 1299, "month"], ["annual", 11999, "year"]] },
]
const ADDONS = [
  { sku: "assistant_100", name: "FlacronSport Extra Assistant Requests", amount: 499 },
  { sku: "day_pass", name: "FlacronSport Premium Day Pass", amount: 199 },
  { sku: "room_pass", name: "FlacronSport Private Event Room Pass", amount: 299 },
  { sku: "export_pack", name: "FlacronSport Report Export Pack", amount: 299 },
]

const products = await stripe.products.list({ limit: 100, active: true }).autoPagingToArray({ limit: 1000 })
const mine = products.filter((product) => product.metadata.app_id === APP_ID)

async function product(sku, name) {
  return (
    mine.find((item) => item.metadata.sku === sku) ??
    stripe.products.create({ name, metadata: { ...metadata, sku } }, { idempotencyKey: `${APP_ID}-product-${sku}` })
  )
}

async function price(productId, sku, amount, recurring) {
  const existing = await stripe.prices.list({ product: productId, active: true, limit: 100 })
  const match = existing.data.find((item) => item.metadata.sku === sku && item.unit_amount === amount)
  if (match) return match.id
  const created = await stripe.prices.create(
    {
      product: productId,
      currency: "usd",
      unit_amount: amount,
      ...(recurring ? { recurring: { interval: recurring } } : {}),
      metadata: { ...metadata, sku },
    },
    { idempotencyKey: `${APP_ID}-price-${sku}-${amount}` },
  )
  return created.id
}

const output = {}
const portalProducts = []

for (const plan of PLANS) {
  const item = await product(plan.sku, plan.name)
  const ids = []
  for (const [interval, amount, recurring] of plan.prices) {
    const id = await price(item.id, `${plan.sku}_${interval}`, amount, recurring)
    output[`STRIPE_PRICE_${plan.sku.toUpperCase()}_${interval.toUpperCase()}`] = id
    ids.push(id)
  }
  portalProducts.push({ product: item.id, prices: ids })
}

for (const addon of ADDONS) {
  const item = await product(addon.sku, addon.name)
  output[`STRIPE_PRICE_${addon.sku.toUpperCase()}`] = await price(item.id, addon.sku, addon.amount)
}

// The default portal configuration is shared by the whole account, so this app has its own.
const configurations = await stripe.billingPortal.configurations.list({ limit: 100 })
const features = {
  invoice_history: { enabled: true },
  payment_method_update: { enabled: true },
  subscription_cancel: { enabled: true, mode: "at_period_end" },
  subscription_update: {
    enabled: true,
    default_allowed_updates: ["price"],
    proration_behavior: "create_prorations",
    products: portalProducts,
  },
}
const existingPortal = configurations.data.find((item) => item.metadata?.app_id === APP_ID && item.active)
const portal = existingPortal
  ? await stripe.billingPortal.configurations.update(existingPortal.id, { features })
  : await stripe.billingPortal.configurations.create({
      business_profile: { headline: "Manage your FlacronSport plan" },
      features,
      metadata,
    })
output.STRIPE_PORTAL_CONFIGURATION = portal.id

for (const [name, value] of Object.entries(output)) console.log(`${name}=${value}`)
