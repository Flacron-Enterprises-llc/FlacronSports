// PDF exports for the export pack. Only FlacronSport's own match summary is
// rendered: no video, and no raw provider payload.

import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import { ApiError } from "@/lib/api-auth"
import { consumePurchasedCredit, hasPurchasedCredit } from "@/lib/billing/allowance"
import type { DocDb } from "@/lib/doc-db"
import type { SportEvent } from "@/lib/sports/types"

export interface MatchSummary {
  title: string
  competition: string
  kickoffUTC: string | null
  status: SportEvent["status"]
  score: string | null
  venue: string | null
}

export type PdfRenderer = (summary: MatchSummary) => Promise<Uint8Array>

export function buildMatchSummary(event: SportEvent): MatchSummary {
  return {
    title: event.participants.map((participant) => participant.name).join(" / "),
    competition: event.competition.name,
    kickoffUTC: event.scheduledStartUTC,
    status: event.status,
    score: event.score.kind === "team" ? `${event.score.home} - ${event.score.away}` : null,
    venue: event.venue,
  }
}

/** The standard PDF font covers Latin-1 only, and provider names can fall outside it. */
export function pdfSafe(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0141\u0142]/g, (char) => (char === "\u0141" ? "L" : "l"))
    .replace(/[^\x20-\x7e\xa0-\xff]/g, "?")
}

export const renderMatchSummaryPdf: PdfRenderer = async (summary) => {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`FlacronSport report: ${pdfSafe(summary.title)}`)
  pdf.setProducer("FlacronSport")
  const page = pdf.addPage([595, 842])
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const navy = rgb(0, 0.16, 0.38)
  const grey = rgb(0.23, 0.29, 0.4)

  page.drawRectangle({ x: 0, y: 802, width: 595, height: 40, color: navy })
  page.drawText("FLACRONSPORT", { x: 40, y: 816, size: 13, font: bold, color: rgb(1, 1, 1) })

  page.drawText(pdfSafe(summary.title).slice(0, 70), { x: 40, y: 750, size: 18, font: bold, color: navy })
  const rows: [string, string | null][] = [
    ["Competition", summary.competition],
    ["Kickoff (UTC)", summary.kickoffUTC?.slice(0, 16).replace("T", " ") ?? "To be confirmed"],
    ["Status", summary.status],
    ["Score", summary.score ?? "Not available"],
    ["Venue", summary.venue],
  ]
  let y = 710
  for (const [label, value] of rows) {
    if (value === null) continue
    page.drawText(label, { x: 40, y, size: 11, font: bold, color: grey })
    page.drawText(pdfSafe(value).slice(0, 70), { x: 170, y, size: 11, font: regular, color: grey })
    y -= 24
  }
  page.drawText("FlacronSport summary from licensed data. Scores can be corrected; official sources control.", { x: 40, y: 40, size: 9, font: regular, color: grey })
  return pdf.save()
}

export function getPdfRenderer(): PdfRenderer | null {
  return renderMatchSummaryPdf
}

/** The credit is taken only after rendering succeeds, and no file leaves without one. */
export async function exportMatchSummary(db: DocDb, input: { uid: string; event: SportEvent; render: PdfRenderer }, now: Date): Promise<Uint8Array> {
  if (!(await hasPurchasedCredit(db, input.uid, "export", now))) {
    throw new ApiError(403, "allowance_exhausted", "You have no export credits left")
  }
  const pdf = await input.render(buildMatchSummary(input.event))
  await consumePurchasedCredit(db, input.uid, "export", now)
  return pdf
}
