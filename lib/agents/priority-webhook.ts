import { CUSTOMER_HEADER } from "@/lib/agents/types"

const DEFAULT_PRIORITY_WEBHOOK_URL =
  "https://redcarpet.app.n8n.cloud/webhook/9a1bc56f-d8c6-472c-a665-833421632caf"

/** Max wait for Priority/n8n tool responses — empty reply after this triggers fallbacks. */
export const PRIORITY_API_TIMEOUT_MS = Number(
  process.env.ORDER_LOOKUP_TIMEOUT_MS ?? "15000"
)

export const PRIORITY_API_PREMESSAGE = `${CUSTOMER_HEADER}
אני על זה, כמה רגעים בבקשה..`

type PriorityApiBeforeCall = (() => void | Promise<void>) | null

let priorityApiBeforeCall: PriorityApiBeforeCall = null
let lastPriorityApiPreMessageAt = 0

/** Landbot sends this once per customer turn before the first Priority/n8n call. */
export function bindPriorityApiBeforeCall(handler: PriorityApiBeforeCall) {
  priorityApiBeforeCall = handler
}

async function maybeSendPriorityApiPreMessage() {
  if (!priorityApiBeforeCall) return
  const now = Date.now()
  if (now - lastPriorityApiPreMessageAt < 2500) return
  lastPriorityApiPreMessageAt = now
  await priorityApiBeforeCall()
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
}): Promise<unknown | null> {
  const url = priorityWebhookUrl()
  if (!url) return null

  const apiKey = process.env.ORDER_LOOKUP_API_KEY?.trim()

  try {
    await maybeSendPriorityApiPreMessage()
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(PRIORITY_API_TIMEOUT_MS),
    })

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
    return null
  }
}

export { DEFAULT_PRIORITY_WEBHOOK_URL }
