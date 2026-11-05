import { ApiError } from "@/lib/api-auth"
import { consumeAssistantRequest, readAssistantBalance, restoreCredit } from "@/lib/billing/allowance"
import type { DocDb } from "@/lib/doc-db"
import type { Locale } from "@/lib/i18n"
import { answerQuestion, type AssistantAnswer, type AssistantSources } from "./engine"

/** The credit leaves before any work starts, so concurrent requests cannot overspend. */
export async function askAssistant(input: {
  db: DocDb
  uid: string
  includedLimit: number
  question: string
  locale: Locale
  sources: AssistantSources
  now: Date
}) {
  const { db, uid, includedLimit, question, locale, sources, now } = input
  const consumed = await consumeAssistantRequest(db, uid, includedLimit, now)

  const giveBack = () =>
    restoreCredit(db, consumed.ticket).catch((failure) => {
      console.error("Credit restore failed", failure instanceof Error ? failure.message : "unknown")
    })

  let answer: AssistantAnswer
  try {
    answer = await answerQuestion(question, locale, sources, now)
  } catch (error) {
    await giveBack()
    console.error("Assistant failed", error instanceof Error ? error.message : "unknown")
    throw new ApiError(503, "assistant_unavailable", "The assistant could not answer. Your request was not counted.")
  }

  if (answer.charged) return { answer, balance: consumed.balance }
  await giveBack()
  return { answer, balance: await readAssistantBalance(db, uid, includedLimit, now) }
}
