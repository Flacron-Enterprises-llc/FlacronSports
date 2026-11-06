import { readFile } from "node:fs/promises"
import path from "node:path"
import { ImageResponse } from "next/og"
import { ApiError, apiErrorResponse } from "@/lib/api-auth"
import { firestoreDocDb } from "@/lib/doc-db"
import { clientIp, rateLimit } from "@/lib/rate-limit"
import { readShare, shareCard } from "@/lib/share/cards"
import { getEvent } from "@/lib/sports/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const NAVY = "#002961"
const ORANGE = "#fe4b01"

let logo: Promise<string> | null = null

// The FS mark is the only image on a card. Team badges have no clear licence for reuse.
const logoData = () => (logo ??= readFile(path.join(process.cwd(), "public/brand/fs-mark-reversed.png")).then((file) => `data:image/png;base64,${file.toString("base64")}`))

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(`share-card:${clientIp(request)}`, 60, 60_000)
    const share = await readShare(firestoreDocDb(), (await params).id)
    const event = share ? await getEvent(share.matchId) : null
    if (!share || !event) throw new ApiError(404, "not_found", "Card not found")
    const card = shareCard(event, share)
    const mark = await logoData()

    return new ImageResponse(
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", padding: 64, background: NAVY, color: "white", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
            <img src={mark} width={105} height={56} />
            <div style={{ display: "flex", fontSize: 30, fontWeight: 700, letterSpacing: 3 }}>FLACRON<span style={{ color: ORANGE }}>SPORT</span></div>
          </div>
          <div style={{ display: "flex", padding: "10px 24px", borderRadius: 999, background: ORANGE, color: NAVY, fontSize: 26, fontWeight: 700 }}>{card.heading}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {card.sides.map((side) => <div key={side} style={{ display: "flex", fontSize: card.sides.length > 1 ? 68 : 60, fontWeight: 700, lineHeight: 1.1 }}>{side}</div>)}
          {card.score && <div style={{ display: "flex", marginTop: 16, fontSize: card.score.length > 24 ? 36 : 64, fontWeight: 700, color: ORANGE }}>{card.score}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 28, color: "rgba(255,255,255,0.82)" }}>
          <div style={{ display: "flex" }}>{card.competition}</div>
          {card.when && <div style={{ display: "flex" }}>{card.when}</div>}
        </div>
      </div>,
      { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=300" } },
    )
  } catch (error) {
    return apiErrorResponse(error)
  }
}
