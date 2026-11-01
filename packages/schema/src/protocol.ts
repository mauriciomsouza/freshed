/**
 * Protocol versioning.
 *
 * PROTOCOL_VERSION is an integer that only increases when the wire format
 * changes in a way an older renderer cannot read. Additive changes (a new
 * optional field, a new action an older renderer ignores) do not bump it.
 *
 * - Every published Version records the protocol it was written with.
 * - Renderers send `Freshed-Protocol: <n>` on every request.
 * - The server never sends a payload newer than the client understands: it
 *   serves the newest published version with `protocol <= n`.
 * - Renderers reject payloads newer than they understand and keep showing
 *   their last good cache instead.
 */
export const PROTOCOL_VERSION = 1

export const PROTOCOL_HEADER = 'Freshed-Protocol'

export class UnsupportedProtocolError extends Error {
  override name = 'UnsupportedProtocolError'
  constructor(
    readonly received: number,
    readonly supported: number,
  ) {
    super(`Payload uses protocol ${received}, this renderer supports up to ${supported}`)
  }
}

export function isCompatible(
  payloadProtocol: number,
  clientProtocol: number = PROTOCOL_VERSION,
): boolean {
  return (
    Number.isInteger(payloadProtocol) && payloadProtocol >= 1 && payloadProtocol <= clientProtocol
  )
}

/** Parses the protocol header; missing or malformed headers mean protocol 1. */
export function parseProtocolHeader(value: string | null | undefined): number {
  const n = Number.parseInt(value ?? '', 10)
  return Number.isInteger(n) && n >= 1 ? n : 1
}
