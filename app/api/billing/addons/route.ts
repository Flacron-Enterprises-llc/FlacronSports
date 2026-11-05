import { NextResponse } from "next/server"
import { addonOnSale, ADDONS } from "@/lib/billing/addons"

export const dynamic = "force-dynamic"

/** Prices are configured on the backend only, so the storefront asks it what is on sale. */
export function GET() {
  return NextResponse.json({ skus: Object.values(ADDONS).filter((addon) => addonOnSale(addon.sku)).map((addon) => addon.sku) })
}
