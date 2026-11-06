// The only file that talks to the Anthropic API. It is a plain fetch because the SDK
// is not a dependency of this app; model.ts sees only the ModelClient shape.

const MESSAGES_URL = "https://api.anthropic.com/v1/messages"
const API_VERSION = "2026-10-21"

export type ModelBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: string; [key: string]: unknown }

export interface ModelMessage {
  role: "assistant"
  content: ModelBlock[]
  stop_reason: string | null
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }
}

export interface ModelRequest {
  model: string
  max_tokens: number
  system: { type: "text"; text: string; cache_control?: { type: "ephemeral" } }[]
  tools: unknown[]
  tool_choice: { type: "auto" }
  output_config: { effort: "low" }
  messages: { role: "user" | "assistant"; content: unknown }[]
  fallbacks?: "default"
  betas?: string[]
}

export interface ModelClient {
  messages: { create(request: ModelRequest, options: { signal: AbortSignal }): Promise<ModelMessage> }
}

/** Carries a short code and nothing else, so no response body or question reaches a log. */
export class ModelFailure extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = "ModelFailure"
  }
}

export function createModelClient(apiKey: string): ModelClient {
  return {
    messages: {
      async create({ betas, ...body }, { signal }) {
        const response = await fetch(MESSAGES_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": API_VERSION,
            ...(betas?.length ? { "anthropic-beta": betas.join(",") } : {}),
          },
          body: JSON.stringify(body),
          signal,
        }).catch(() => {
          throw new ModelFailure(signal.aborted ? "timeout" : "network")
        })
        if (!response.ok) {
          await response.body?.cancel().catch(() => undefined)
          throw new ModelFailure(`http_${response.status}`)
        }
        return (await response.json().catch(() => {
          throw new ModelFailure("bad_response")
        })) as ModelMessage
      },
    },
  }
}

/** Null without a key, which leaves the deterministic engine answering. */
export function modelClientFromEnv(): ModelClient | null {
  const key = process.env.ANTHROPIC_API_KEY?.trim()
  return key ? createModelClient(key) : null
}
