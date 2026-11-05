import { brandedEmail, sendEmail } from "@/lib/email-service"

const COPY = {
  verifyEmail: {
    subject: "Verify your FlacronSport email",
    heading: "Confirm your email address",
    body: "Confirm this address to finish setting up your FlacronSport account.",
    cta: "Verify email",
  },
  resetPassword: {
    subject: "Reset your FlacronSport password",
    heading: "Reset your password",
    body: "Use this link to choose a new password. It expires soon.",
    cta: "Reset password",
  },
} as const

/** Moves the one-time code onto our own domain, where /auth/action applies it. */
export function ownDomainLink(firebaseLink: string, mode: keyof typeof COPY, siteUrl: string): string {
  const oobCode = new URL(firebaseLink).searchParams.get("oobCode")
  if (!oobCode) throw new Error("Action link has no code")
  return `${siteUrl}/auth/action?${new URLSearchParams({ mode, oobCode })}`
}

export async function actionEmail(to: string, mode: keyof typeof COPY, firebaseLink: string): Promise<boolean> {
  const siteUrl = process.env.APP_BASE_URL || "https://flacronsport.com"
  const copy = COPY[mode]
  const url = ownDomainLink(firebaseLink, mode, siteUrl)
  const { html, text } = brandedEmail({
    heading: copy.heading,
    body: copy.body,
    cta: copy.cta,
    url,
    footnote: "If you did not ask for this, you can ignore this email.",
    siteUrl,
  })
  return sendEmail({ to, subject: copy.subject, html, text })
}
