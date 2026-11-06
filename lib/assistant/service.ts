import { ApiError } from "@/lib/api-auth"
import { consumeAssistantRequest, readAssistantBalance, restoreCredit } from "@/lib/billing/allowance"
import type { DocDb } from "@/lib/doc-db"
import type { Locale } from "@/lib/i18n"
import { ModelFailure, type ModelClient } from "./anthropic-client"
import { answerQuestion, type AssistantAnswer, type AssistantSources } from "./engine"
import { answerWithModel, assistantModel, type ModelSources } from "./model"

/** The credit leaves before any work starts, so concurrent requests cannot overspend. */
export async function askAssistant(input: {
  db: DocDb
  uid: string
  includedLimit: number
  question: string
  locale: Locale
  sources: AssistantSources
  now: Date
  /** Absent or with a null client, the deterministic engine answers as usual. */
  model?: { client: ModelClient | null; sources: ModelSources; spoiler: boolean }
}) {
  const { db, uid, includedLimit, question, locale, sources, now, model } = input
  const consumed = await consumeAssistantRequest(db, uid, includedLimit, now)

  const giveBack = () =>
    restoreCredit(db, consumed.ticket).catch((failure) => {
      console.error("Credit restore failed", failure instanceof Error ? failure.message : "unknown")
    })

  const answerFor = async (): Promise<AssistantAnswer> => {
    if (!model?.client) return answerQuestion(question, locale, sources, now)
    try {
      return await answerWithModel({ client: model.client, question, locale, sources: model.sources, now, spoiler: model.spoiler, model: assistantModel() })
    } catch (error) {
      console.error("Assistant model failed", error instanceof ModelFailure ? error.code : "unexpected")
      // The member still gets the engine's answer, but a failed model call is never charged.
      return { ...(await answerQuestion(question, locale, sources, now)), charged: false }
    }
  }

  let answer: AssistantAnswer
  try {
    answer = await answerFor()
  } catch (error) {
    await giveBack()
    console.error("Assistant failed", error instanceof Error ? error.message : "unknown")
    throw new ApiError(503, "assistant_unavailable", "The assistant could not answer. Your request was not counted.")
  }

  if (answer.charged) return { answer, balance: consumed.balance }
  await giveBack()
  return { answer, balance: await readAssistantBalance(db, uid, includedLimit, now) }
}
