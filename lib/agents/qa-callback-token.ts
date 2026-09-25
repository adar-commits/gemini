import { createHmac, timingSafeEqual } from "node:crypto"
import { isCronAuthorized, resolveCronSecret } from "@/lib/agents/cron-auth"

/**
 * Per-event token sent in the webhook payload so the automation can report back without
 * holding CRON_SECRET (Cursor automations have no secrets store). Valid only for its own
 * idempotency key.
 */
export function qaCallbackToken(idempotencyKey: string) {
  const secret = resolveCronSecret()
  if (!secret || !idempotencyKey.trim()) return null
  return createHmac("sha256", secret)
    .update(`qa-callback:${idempotencyKey.trim()}`)
    .digest("hex")
    .slice(0, 40)
}

function bearer(request: Request) {
  return (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim()
}

export function isQaCallbackAuthorized(request: Request, idempotencyKey: string | null) {
  if (isCronAuthorized(request)) return true
  if (!idempotencyKey) return false
  const expected = qaCallbackToken(idempotencyKey)
  const provided = bearer(request)
  if (!expected || provided.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
}
