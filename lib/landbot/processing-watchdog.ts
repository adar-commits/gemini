import { buildProcessingStuckReply } from "@/lib/agent-core/fallbacks"
import { CUSTOMER_HEADER } from "@/lib/agents/types"

/** If the pipeline has not sent anything after an inbound turn, offer service handoff. */
const PRIORITY_API_TIMEOUT_MS = Number(process.env.ORDER_LOOKUP_TIMEOUT_MS ?? "15000")
export const PROCESSING_STUCK_MS = Number(
  process.env.PROCESSING_STUCK_MS ?? String(PRIORITY_API_TIMEOUT_MS + 30_000)
)

export type ProcessingWatchdogController = {
  markReplySent: () => void
  stuckAlreadySent: () => boolean
}

/** Fire stuck handoff once if no customer-visible reply was sent in time. */
export function startProcessingWatchdog(input: {
  replyEnabled: boolean
  onStuck: () => void | Promise<void>
  timeoutMs?: number
}): ProcessingWatchdogController {
  if (!input.replyEnabled) {
    return { markReplySent: () => {}, stuckAlreadySent: () => false }
  }

  let replySent = false
  let stuckSent = false
  let timer: ReturnType<typeof setTimeout> | null = setTimeout(async () => {
    if (replySent || stuckSent) return
    stuckSent = true
    replySent = true
    try {
      await input.onStuck()
    } catch (error) {
      console.error("[processing-watchdog] stuck handler failed", error)
    }
  }, input.timeoutMs ?? PROCESSING_STUCK_MS)

  return {
    markReplySent() {
      replySent = true
      if (timer) clearTimeout(timer)
      timer = null
    },
    stuckAlreadySent() {
      return stuckSent
    },
  }
}
