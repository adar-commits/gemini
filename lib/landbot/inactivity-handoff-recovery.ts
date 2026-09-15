import {
  buildHumanHandoffConfirmedReply,
  type HumanHandoffAction,
} from "@/lib/agents/human-agent-hours"
import {
  clearInactivityWatchState,
  recordProactiveAssistantMessage,
} from "@/lib/agents/memory"
import { inferHumanHandoffAction } from "@/lib/agents/off-topic"
import { isInactivityAssistantMessage } from "@/lib/agents/inactivity"
import {
  isActiveSalesConsultation,
  isConfirmationPending,
} from "@/lib/agents/sales-intake"
import type { AgentId, HistoryMessage } from "@/lib/agents/types"
import { CUSTOMER_HEADER } from "@/lib/agents/types"
import { sendCustomerText } from "@/lib/landbot/client"
import { executeHumanHandoff } from "@/lib/landbot/human-handoff"

function isPendingServiceHandoffSummary(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    return /מסכם\s+את\s+הפנייה|עבור\s+נציג\s+שירות/i.test(message.content)
  }
  return false
}

export function resolveInactivityHandoffAction(
  history: HistoryMessage[],
  lastAgent: AgentId | null = null
): HumanHandoffAction {
  if (isConfirmationPending(history)) return "human_sales"
  if (isActiveSalesConsultation(history, lastAgent)) return "human_sales"
  if (isPendingServiceHandoffSummary(history)) return "human_service"
  return inferHumanHandoffAction(history, lastAgent)
}

function buildInactivityHandoffRecoveryReply(
  action: HumanHandoffAction,
  now = new Date()
) {
  const body = buildHumanHandoffConfirmedReply(action, now)
  return `${CUSTOMER_HEADER}\n${body}`
}

/**
 * Quiet-window handoff recovery: assign to the right human queue instead of
 * pinging "עדיין כאן?" when a sales/service handoff is already pending.
 */
export async function executeInactivityHandoffRecovery(input: {
  conversationId: string
  customerId: number
  history: HistoryMessage[]
  lastAgent?: AgentId | null
  /** Sales quiz / מכירות timeout — CRM assign only, no customer message. */
  silent?: boolean
}) {
  const action = resolveInactivityHandoffAction(
    input.history,
    input.lastAgent ?? null
  )

  await executeHumanHandoff({
    conversationId: input.conversationId,
    customerId: input.customerId,
    action,
  })

  if (!input.silent) {
    const reply = buildInactivityHandoffRecoveryReply(action)
    await sendCustomerText(input.customerId, reply)
    await recordProactiveAssistantMessage({
      conversationId: input.conversationId,
      assistantText: reply,
      action,
    })
  }

  await clearInactivityWatchState(input.conversationId)

  return {
    ok: true as const,
    sent: input.silent ? ("silent_handoff" as const) : ("handoff_recovery" as const),
    action,
  }
}
