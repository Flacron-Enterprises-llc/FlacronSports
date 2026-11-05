import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2"
import { APP_ID } from "@/lib/billing/plans"

export interface OutboundEmail {
  to: string
  subject: string
  html: string
  text: string
}

let client: SESv2Client | null = null

/** Amazon SES. Credentials come from the ECS task role, so no key is configured. */
export async function sendEmail(email: OutboundEmail): Promise<boolean> {
  const region = process.env.SES_REGION
  const from = process.env.EMAIL_FROM
  if (!region || !from) {
    // Outside production nothing is sent. Addresses and links are never logged.
    console.warn("Email is not configured; not sent:", email.subject)
    return false
  }

  client ??= new SESv2Client({ region })
  await client.send(
    new SendEmailCommand({
      FromEmailAddress: from,
      Destination: { ToAddresses: [email.to] },
      Content: {
        Simple: {
          Subject: { Data: email.subject, Charset: "UTF-8" },
          Body: { Html: { Data: email.html, Charset: "UTF-8" }, Text: { Data: email.text, Charset: "UTF-8" } },
        },
      },
      EmailTags: [{ Name: "app_id", Value: APP_ID }],
    }),
  )
  return true
}

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ENTITIES[char])

export function brandedEmail(options: {
  heading: string
  body: string
  cta: string
  url: string
  footnote: string
  siteUrl: string
}): { html: string; text: string } {
  const { heading, body, cta, url, footnote, siteUrl } = options
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f5f7fa;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0a1a33">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#001a3f;padding:22px 28px"><img src="${escapeHtml(siteUrl)}/brand/fs-mark-reversed.png" alt="FlacronSport" height="28"></td></tr>
<tr><td style="height:4px;background:#fe4b01;line-height:4px;font-size:0">&nbsp;</td></tr>
<tr><td style="padding:32px 28px 8px"><h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#0a1a33">${escapeHtml(heading)}</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3a4b66">${escapeHtml(body)}</p>
<a href="${escapeHtml(url)}" style="display:inline-block;background:#fe4b01;color:#0a1a33;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:6px">${escapeHtml(cta)}</a></td></tr>
<tr><td style="padding:20px 28px 28px;font-size:12px;line-height:1.6;color:#5c6b82">${escapeHtml(footnote)}</td></tr>
</table></td></tr></table></body></html>`
  const text = `${heading}\n\n${body}\n\n${cta}: ${url}\n\n${footnote}\n\nFlacronSport, a product of Flacron Enterprises LLC`
  return { html, text }
}
