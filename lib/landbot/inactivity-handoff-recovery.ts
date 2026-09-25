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
import { isServiceHandoffSummaryPending } from "@/lib/agents/service-intake"
import type { AgentId, HistoryMessage } from "@/lib/agents/types"
import { CUSTOMER_HEADER } from "@/lib/agents/types"
import { sendCustomerText } from "@/lib/landbot/client"
import { executeHumanHandoff } from "@/lib/landbot/human-handoff"
import { scheduleCursorAutomationQa } from "@/lib/landbot/schedule-cursor-automation-qa"

export function resolveInactivityHandoffAction(
  history: HistoryMessage[],
  lastAgent: AgentId | null = null
): HumanHandoffAction {
  if (isServiceHandoffSummaryPending(history)) return "human_service"
  if (isConfirmationPending(history)) return "human_sales"
  if (isActiveSalesConsultation(history, lastAgent)) return "human_sales"
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

  const lastCustomer = [...input.history].reverse().find((message) => message.role === "user")
  const lastAssistant = [...input.history]
    .reverse()
    .find((message) => message.role === "assistant")
  scheduleCursorAutomationQa({
    conversationId: input.conversationId,
    trigger: "human_assign",
    handoffAction: action,
    lastUserMessage: lastCustomer?.content,
    lastBotReply: input.silent
      ? lastAssistant?.content
      : buildInactivityHandoffRecoveryReply(action),
  })

  return {
    ok: true as const,
    sent: input.silent ? ("silent_handoff" as const) : ("handoff_recovery" as const),
    action,
  }
}

/** CRM assign only — no customer message (handoff offer / summary quiet timeout). */
export async function executeInactivitySilentQueueRecovery(input: {
  conversationId: string
  customerId: number
}) {
  const { getConversationContext } = await import("@/lib/agents/memory")
  const context = await getConversationContext(input.conversationId)
  return executeInactivityHandoffRecovery({
    ...input,
    history: context.history,
    lastAgent: context.lastAgent,
    silent: true,
  })
}
