import type { Provider, ProviderRequest } from './types.js'

/**
 * Replays canned outputs in order. Used by tests (no network) and by the
 * Studio's pre-recorded demo. `requests` records what was sent.
 */
export function mockProvider(
  outputs: unknown[],
  options: { model?: string; delayMs?: number } = {},
) {
  const queue = [...outputs]
  const requests: ProviderRequest[] = []
  const provider: Provider & { requests: ProviderRequest[] } = {
    id: 'mock',
    model: options.model ?? 'mock-model',
    requests,
    async generate(request) {
      requests.push(request)
      if (options.delayMs) await new Promise((r) => setTimeout(r, options.delayMs))
      if (!queue.length) throw new Error('mockProvider: no more outputs queued')
      return { output: queue.shift(), model: provider.model }
    },
  }
  return provider
}
