// PDF exports for the export pack (spec section 14). Only FlacronSport's own match
// summaries and comparisons are rendered: no video, and no raw provider payload.

import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import { ApiError } from "@/lib/api-auth"
import { consumePurchasedCredit, hasPurchasedCredit } from "@/lib/billing/allowance"
import type { DocDb } from "@/lib/doc-db"
import { getDictionary } from "@/lib/i18n"
import type { ComparisonSheet } from "@/lib/sports/compare-rows"
import { eventTitle, resultLine } from "@/lib/sports/presentation"
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
    title: eventTitle(event),
    competition: event.competition.name,
    kickoffUTC: event.dateOnly ? null : event.scheduledStartUTC,
    status: event.status,
    score: resultLine(event, getDictionary("en")),
    venue: event.venue,
  }
}

const STATUS_LABEL: Record<SportEvent["status"], string> = {
  scheduled: "Upcoming",
  live: "Live",
  finished: "Finished",
  postponed: "Postponed",
  canceled: "Canceled",
  interrupted: "Interrupted",
  abandoned: "Abandoned",
  unknown: "Not confirmed",
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
    ["Status", STATUS_LABEL[summary.status]],
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

export const renderComparisonPdf = async (sheet: ComparisonSheet): Promise<Uint8Array> => {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`FlacronSport: ${pdfSafe(sheet.title)}`)
  pdf.setProducer("FlacronSport")
  const page = pdf.addPage([595, 842])
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const navy = rgb(0, 0.16, 0.38)
  const grey = rgb(0.23, 0.29, 0.4)
  const clip = (text: string, length: number) => pdfSafe(text).slice(0, length)

  page.drawRectangle({ x: 0, y: 802, width: 595, height: 40, color: navy })
  page.drawText("FLACRONSPORT", { x: 40, y: 816, size: 13, font: bold, color: rgb(1, 1, 1) })
  page.drawText(clip(sheet.title, 60), { x: 40, y: 750, size: 16, font: bold, color: navy })

  let y = 716
  const line = (label: string, first: string, second: string, font = regular) => {
    page.drawText(clip(label, 30), { x: 40, y, size: 10, font: bold, color: grey })
    page.drawText(clip(first, 30), { x: 220, y, size: 10, font, color: grey })
    page.drawText(clip(second, 30), { x: 400, y, size: 10, font, color: grey })
    y -= 22
  }
  line(sheet.measure, sheet.names[0], sheet.names[1], bold)
  for (const [label, first, second] of sheet.rows) line(label, first, second)
  for (const note of sheet.notes) {
    y -= 4
    page.drawText(clip(note, 95), { x: 40, y, size: 10, font: regular, color: grey })
    y -= 14
  }
  page.drawText(clip(sheet.footer, 110), { x: 40, y: 40, size: 9, font: regular, color: grey })
  return pdf.save()
}

/** The credit is taken only after the file exists, and no file leaves without one. */
async function spendCredit(db: DocDb, uid: string, now: Date, generate: () => Promise<Uint8Array>): Promise<Uint8Array> {
  if (!(await hasPurchasedCredit(db, uid, "export", now))) {
    throw new ApiError(403, "allowance_exhausted", "You have no export credits left")
  }
  const pdf = await generate()
  await consumePurchasedCredit(db, uid, "export", now)
  return pdf
}

export function exportMatchSummary(db: DocDb, input: { uid: string; event: SportEvent; render: PdfRenderer }, now: Date): Promise<Uint8Array> {
  return spendCredit(db, input.uid, now, () => input.render(buildMatchSummary(input.event)))
}

/** `load` builds the comparison on the server, so a request can never supply its figures. */
export function exportComparison(db: DocDb, input: { uid: string; load: () => Promise<ComparisonSheet>; render: (sheet: ComparisonSheet) => Promise<Uint8Array> }, now: Date): Promise<Uint8Array> {
  return spendCredit(db, input.uid, now, async () => input.render(await input.load()))
}
