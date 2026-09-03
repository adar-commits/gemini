import { validatePriorityApiPayload } from "@/lib/agents/phone-for-api"
import { CUSTOMER_HEADER } from "@/lib/agents/types"

const DEFAULT_PRIORITY_WEBHOOK_URL =
  "https://redcarpet.app.n8n.cloud/webhook/9a1bc56f-d8c6-472c-a665-833421632caf"

/** Wait this long before sending a hold bubble — fast lookups stay silent. */
export function priorityPreMessageDelayMs() {
  return Number(process.env.PRIORITY_PREMESSAGE_DELAY_MS ?? "2500")
}

/** Max wait for Priority/n8n tool responses — empty reply after this triggers fallbacks. */
export const PRIORITY_API_TIMEOUT_MS = Number(
  process.env.ORDER_LOOKUP_TIMEOUT_MS ?? "15000"
)

/** Matches legacy and current Priority wait bubbles in thread history. */
export const PRIORITY_API_WAIT_PHRASE_RE =
  /אני על זה,?\s*(?:—|-)?\s*(?:עוד\s+)?(?:כמה\s+)?רגע/i

export function isPriorityApiWaitMessage(content: string) {
  return PRIORITY_API_WAIT_PHRASE_RE.test(content)
}

export const PRIORITY_API_PREMESSAGE = `${CUSTOMER_HEADER}
אני על זה — עוד כמה רגעים 🙏`

type PriorityApiBeforeCall = (() => void | Promise<void>) | null

let priorityApiBeforeCall: PriorityApiBeforeCall = null
let priorityApiPreMessageSentThisTurn = false
let priorityApiPreMessageSkipGuard: (() => boolean) | null = null
let priorityApiPreMessageTimer: ReturnType<typeof setTimeout> | null = null
let priorityApiEnabled = true
let priorityApiLogContext: { conversationId?: string; whatsappPhone?: string } = {}

/** Landbot sends this once per customer turn before the first Priority/n8n call. */
export function bindPriorityApiBeforeCall(handler: PriorityApiBeforeCall) {
  priorityApiBeforeCall = handler
}

export function resetPriorityApiTurnState() {
  cancelPriorityApiPreMessageTimer()
  priorityApiPreMessageSentThisTurn = false
  priorityApiEnabled = true
  priorityApiLogContext = {}
}

function cancelPriorityApiPreMessageTimer() {
  if (priorityApiPreMessageTimer) {
    clearTimeout(priorityApiPreMessageTimer)
    priorityApiPreMessageTimer = null
  }
}

/** Shadow / preview turns skip live n8n calls — avoids ghost getOrders from non-reply phones. */
export function bindPriorityApiEnabled(enabled: boolean) {
  priorityApiEnabled = enabled
}

export function bindPriorityApiLogContext(context: {
  conversationId?: string
  whatsappPhone?: string
}) {
  priorityApiLogContext = context
}

export function getPriorityApiLogContext() {
  return priorityApiLogContext
}

/** When true, skip the pre-message (e.g. already sent earlier in this conversation). */
export function bindPriorityApiPreMessageGuard(guard: (() => boolean) | null) {
  priorityApiPreMessageSkipGuard = guard
}

/** True when a wait bubble was already sent this turn — retry must not re-call Priority tools. */
export function wasPriorityApiPreMessageSentThisTurn() {
  return priorityApiPreMessageSentThisTurn
}

async function maybeSendPriorityApiPreMessage() {
  if (!priorityApiBeforeCall) return
  if (priorityApiPreMessageSentThisTurn) return
  if (priorityApiPreMessageSkipGuard?.()) return
  if (priorityApiPreMessageTimer) return

  priorityApiPreMessageTimer = setTimeout(async () => {
    priorityApiPreMessageTimer = null
    if (!priorityApiBeforeCall) return
    if (priorityApiPreMessageSentThisTurn) return
    if (priorityApiPreMessageSkipGuard?.()) return
    priorityApiPreMessageSentThisTurn = true
    try {
      await priorityApiBeforeCall()
    } catch (error) {
      console.warn("[priority-api] pre-message handler failed", error)
    }
  }, priorityPreMessageDelayMs())
}

export function priorityWebhookUrl(fallback = DEFAULT_PRIORITY_WEBHOOK_URL) {
  return (
    process.env.ORDER_LOOKUP_API_URL?.trim() ||
    process.env.N8N_ORDER_LOOKUP_WEBHOOK_URL?.trim() ||
    fallback
  )
}

/** Same n8n webhook as order lookup — actionType selects the operation. */
export async function callPriorityWebhook(input: {
  actionType: string
  value: string
  documentType?: string
}): Promise<unknown | null> {
  const url = priorityWebhookUrl()
  if (!url) return null

  const apiKey = process.env.ORDER_LOOKUP_API_KEY?.trim()

  if (!priorityApiEnabled) {
    console.info("[priority-api] skipped (shadow/preview)", {
      actionType: input.actionType,
      value: input.value,
      conversationId: priorityApiLogContext.conversationId ?? null,
      whatsappPhone: priorityApiLogContext.whatsappPhone ?? null,
    })
    return null
  }

  const validated = validatePriorityApiPayload(input)
  if (!validated.ok) {
    console.warn("[priority-api] blocked invalid payload", {
      actionType: input.actionType,
      value: input.value,
      reason: validated.reason,
      conversationId: priorityApiLogContext.conversationId ?? null,
      whatsappPhone: priorityApiLogContext.whatsappPhone ?? null,
    })
    return null
  }

  try {
    console.info("[priority-api] request", {
      actionType: input.actionType,
      value: validated.value,
      conversationId: priorityApiLogContext.conversationId ?? null,
      whatsappPhone: priorityApiLogContext.whatsappPhone ?? null,
    })
    await maybeSendPriorityApiPreMessage()
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        actionType: input.actionType,
        value: validated.value,
        ...(input.documentType ? { documentType: input.documentType } : {}),
      }),
      signal: AbortSignal.timeout(PRIORITY_API_TIMEOUT_MS),
    })

    cancelPriorityApiPreMessageTimer()

    if (!response.ok) return null

    const contentType = response.headers.get("content-type") ?? ""
    const text = (await response.text()).trim()
    if (!text) return null

    if (contentType.includes("application/json") || text.startsWith("{") || text.startsWith("[")) {
      try {
        return JSON.parse(text) as unknown
      } catch {
        return null
      }
    }

    return null
  } catch {
    cancelPriorityApiPreMessageTimer()
    return null
  }
}

export { DEFAULT_PRIORITY_WEBHOOK_URL }
