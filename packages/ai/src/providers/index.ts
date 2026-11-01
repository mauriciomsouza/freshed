import { anthropicProvider, DEFAULT_ANTHROPIC_MODEL } from './anthropic.js'
import { openAICompatibleProvider } from './openai.js'
import type { Provider } from './types.js'

export * from './anthropic.js'
export * from './mock.js'
export * from './openai.js'
export * from './types.js'

export type ProviderId = 'anthropic' | 'openai-compatible'

export type ProviderConfig = {
  provider: ProviderId
  apiKey: string
  model?: string
  baseUrl?: string
  browser?: boolean
  fetch?: typeof fetch
}

export function createProvider(config: ProviderConfig): Provider {
  if (!config.apiKey) throw new Error('freshed ai: an API key is required (bring your own key)')
  if (config.provider === 'anthropic') {
    return anthropicProvider({
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: config.baseUrl,
      browser: config.browser,
      fetch: config.fetch,
    })
  }
  if (!config.model)
    throw new Error('freshed ai: set a model for OpenAI-compatible providers (FRESHED_AI_MODEL)')
  return openAICompatibleProvider({
    apiKey: config.apiKey,
    model: config.model,
    baseUrl: config.baseUrl,
    fetch: config.fetch,
  })
}

/**
 * Reads provider configuration from environment variables:
 *   FRESHED_AI_KEY       required
 *   FRESHED_AI_PROVIDER  "anthropic" (default) | "openai-compatible"
 *   FRESHED_AI_MODEL     optional for Anthropic (defaults to DEFAULT_ANTHROPIC_MODEL)
 *   FRESHED_AI_BASE_URL  optional
 * Returns null when no key is set, so callers can show a helpful message.
 */
export function providerFromEnv(
  env: Record<string, string | undefined>,
  fetchImpl?: typeof fetch,
): Provider | null {
  const apiKey = env.FRESHED_AI_KEY?.trim()
  if (!apiKey) return null
  const provider = (env.FRESHED_AI_PROVIDER?.trim() || 'anthropic') as ProviderId
  if (provider !== 'anthropic' && provider !== 'openai-compatible') {
    throw new Error(`freshed ai: unknown FRESHED_AI_PROVIDER "${provider}"`)
  }
  return createProvider({
    provider,
    apiKey,
    model:
      env.FRESHED_AI_MODEL?.trim() ||
      (provider === 'anthropic' ? DEFAULT_ANTHROPIC_MODEL : undefined),
    baseUrl: env.FRESHED_AI_BASE_URL?.trim() || undefined,
    fetch: fetchImpl,
  })
}
