export type ChatMessage = { role: 'user' | 'assistant'; content: string }

export type ToolSpec = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export type ProviderRequest = {
  system: string
  messages: ChatMessage[]
  /** The model is forced to call this tool; its input is the structured output. */
  tool: ToolSpec
  maxTokens?: number
  signal?: AbortSignal
}

export type ProviderResponse = {
  /** The tool input exactly as the model produced it (unvalidated). */
  output: unknown
  model: string
  usage?: { inputTokens?: number; outputTokens?: number }
}

/**
 * A provider turns a request into a forced tool call. Adapters only speak
 * HTTP via `fetch`, so the same code runs in Node (CLI, server) and in the
 * browser (Studio, with the visitor's own key).
 */
export interface Provider {
  readonly id: string
  readonly model: string
  generate(request: ProviderRequest): Promise<ProviderResponse>
}

export class ProviderError extends Error {
  override name = 'ProviderError'
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
  }
}

/** Strips anything that looks like a credential from text before it is shown or logged. */
export function redact(text: string): string {
  return text
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-…redacted')
    .replace(/(x-api-key|authorization)["']?\s*[:=]\s*["']?[^\s"',}]+/gi, '$1: …redacted')
}
