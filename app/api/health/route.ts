import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/** Liveness only: it must stay fast and must not depend on upstream providers. */
export function GET() {
  return NextResponse.json({ status: "ok", commit: process.env.GIT_COMMIT_SHA ?? null })
}
