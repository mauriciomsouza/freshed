import {
  ProviderError,
  redact,
  type Provider,
  type ProviderRequest,
  type ProviderResponse,
} from './types.js'

export type OpenAICompatibleOptions = {
  apiKey: string
  /** Required: OpenAI-compatible servers differ in model names. */
  model: string
  /** e.g. "https://api.openai.com/v1", or a local/hosted compatible endpoint. */
  baseUrl?: string
  fetch?: typeof fetch
}

/**
 * Any server that implements the OpenAI Chat Completions API with function
 * calling. The tool is forced with `tool_choice`.
 */
export function openAICompatibleProvider(options: OpenAICompatibleOptions): Provider {
  const baseUrl = (options.baseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '')
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis)

  return {
    id: 'openai-compatible',
    model: options.model,
    async generate(request: ProviderRequest): Promise<ProviderResponse> {
      const res = await doFetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal: request.signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${options.apiKey}` },
        body: JSON.stringify({
          model: options.model,
          max_tokens: request.maxTokens ?? 8000,
          messages: [{ role: 'system', content: request.system }, ...request.messages],
          tools: [
            {
              type: 'function',
              function: {
                name: request.tool.name,
                description: request.tool.description,
                parameters: request.tool.inputSchema,
              },
            },
          ],
          tool_choice: { type: 'function', function: { name: request.tool.name } },
        }),
      })
      if (!res.ok) {
        const detail = redact((await res.text().catch(() => '')).slice(0, 300))
        throw new ProviderError(`Provider request failed (${res.status}): ${detail}`, res.status)
      }
      const body = (await res.json()) as {
        model?: string
        choices?: {
          message?: { tool_calls?: { function?: { name?: string; arguments?: string } }[] }
        }[]
        usage?: { prompt_tokens?: number; completion_tokens?: number }
      }
      const call = body.choices?.[0]?.message?.tool_calls?.find(
        (t) => t.function?.name === request.tool.name,
      )
      if (!call?.function?.arguments)
        throw new ProviderError('Response did not include the expected tool call')
      let output: unknown
      try {
        output = JSON.parse(call.function.arguments)
      } catch {
        // Hand the raw string to validation so the repair turn can explain the problem.
        output = call.function.arguments
      }
      return {
        output,
        model: body.model ?? options.model,
        usage: {
          inputTokens: body.usage?.prompt_tokens,
          outputTokens: body.usage?.completion_tokens,
        },
      }
    },
  }
}
