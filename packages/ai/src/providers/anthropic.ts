import {
  ProviderError,
  redact,
  type Provider,
  type ProviderRequest,
  type ProviderResponse,
} from './types.js'

export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5'

export type AnthropicOptions = {
  apiKey: string
  model?: string
  baseUrl?: string
  /**
   * Set when calling from a browser with the visitor's own key. Anthropic
   * requires an explicit opt-in header for direct browser access.
   */
  browser?: boolean
  fetch?: typeof fetch
}

type AnthropicContent =
  { type: 'text'; text: string } | { type: 'tool_use'; name: string; input: unknown }

/** Anthropic Messages API with a forced tool call (structured output). */
export function anthropicProvider(options: AnthropicOptions): Provider {
  const model = options.model ?? DEFAULT_ANTHROPIC_MODEL
  const baseUrl = (options.baseUrl ?? 'https://api.anthropic.com').replace(/\/+$/, '')
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis)

  return {
    id: 'anthropic',
    model,
    async generate(request: ProviderRequest): Promise<ProviderResponse> {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        'x-api-key': options.apiKey,
        'anthropic-version': '2023-06-01',
      }
      if (options.browser) headers['anthropic-dangerous-direct-browser-access'] = 'true'

      const res = await doFetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers,
        signal: request.signal,
        body: JSON.stringify({
          model,
          max_tokens: request.maxTokens ?? 8000,
          system: request.system,
          messages: request.messages,
          tools: [
            {
              name: request.tool.name,
              description: request.tool.description,
              input_schema: request.tool.inputSchema,
            },
          ],
          tool_choice: { type: 'tool', name: request.tool.name },
        }),
      })
      if (!res.ok) {
        const detail = redact((await res.text().catch(() => '')).slice(0, 300))
        throw new ProviderError(`Anthropic request failed (${res.status}): ${detail}`, res.status)
      }
      const body = (await res.json()) as {
        content?: AnthropicContent[]
        model?: string
        usage?: { input_tokens?: number; output_tokens?: number }
      }
      const call = body.content?.find(
        (c): c is Extract<AnthropicContent, { type: 'tool_use' }> =>
          c.type === 'tool_use' && c.name === request.tool.name,
      )
      if (!call)
        throw new ProviderError('Anthropic response did not include the expected tool call')
      return {
        output: call.input,
        model: body.model ?? model,
        usage: { inputTokens: body.usage?.input_tokens, outputTokens: body.usage?.output_tokens },
      }
    },
  }
}
