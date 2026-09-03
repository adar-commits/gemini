import { runCustomerConversation } from "@/lib/agents/conversation"
import { formatOutboundMessages } from "@/lib/agents/greeting"
import { shouldSkipInactivityForHumanWait } from "@/lib/agents/human-waiting"
import { appendTurn, clearInactivityWatchState, getHistory, getSessionInactivityState, recordProactiveAssistantMessage } from "@/lib/agents/memory"
import type { UserTurn } from "@/lib/agents/user-turn"
import { summarizeTurn } from "@/lib/agents/user-turn"
import {
  assignToApiAgent,
  assignToHuman,
  getCustomer,
  sendCustomerText,
  unassignCustomer,
} from "@/lib/landbot/client"
import { PRIORITY_API_PREMESSAGE } from "@/lib/agents/priority-webhook"
import { pickHumanAgentId } from "@/lib/landbot/human-agents"
import { logShadowTurn } from "@/lib/landbot/shadow-log"
import {
  buildTrainerResetReply,
  isTrainerResetRequest,
  resetTrainerConversation,
  splitTrainerResetBody,
} from "@/lib/landbot/trainer-reset"
import {
  isTrainerCorrectionCommand,
  isTrainerQuestionCommand,
  stripTrainerQuestionPrefix,
} from "@/lib/landbot/training-guards"
import {
  answerTrainerQuestion,
  TRAINER_QUESTION_EMPTY_HINT,
} from "@/lib/landbot/trainer-question"
import {
  processTrainerCorrection,
  TRAINER_CORRECTION_ACK,
  TRAINER_CORRECTION_DONE,
} from "@/lib/landbot/trainer-correction"
import { isTrainerPhone } from "@/lib/landbot/trainer"
import {
  ensureSessionMetaFromInbound,
  runInactivityPipeline,
} from "@/lib/landbot/inactivity-watcher"
import { shouldSuppressInactivityWatch } from "@/lib/agents/inactivity"
import { after } from "next/server"
import type { AgentResponse } from "@/lib/agents/types"
import { buildNeverStuckReply, buildProcessingStuckReply } from "@/lib/agent-core/fallbacks"
import { salvageReturnPickupAwaitingReply } from "@/lib/agents/service-intake"
import { coalesceTrailingBufferedTurn } from "@/lib/landbot/message-buffer"
import {
  isHumanThreadActive,
  recordHumanAgentActivity,
  releaseHumanThread,
} from "@/lib/landbot/human-takeover"
import {
  handleTrainerProfileCommand,
  isTrainerProfileCommand,
} from "@/lib/landbot/trainer-runtime"
import { startProcessingWatchdog } from "@/lib/landbot/processing-watchdog"
import { debugSessionLog } from "@/lib/debug/session-log"

export type InboundMode = "reply" | "shadow"

export type LandbotInboundResult = AgentResponse & {
  mode: InboundMode
  draft_reply?: string
  /** True when a customer-visible message already included *הום בוט :)* this drain. */
  outbound_header_sent?: boolean
  /** Bot intentionally stayed silent (e.g. human rep owns the thread). */
  skipped?: string
}

function outboundReply(result: AgentResponse) {
  if (result.reply) return result.reply
  if (result.action === "human_service") {
    return "*הום בוט :)*\nהפנייה הועברה לנציג שירות. ניצור קשר בהקדם."
  }
  if (result.action === "human_sales") {
    return "*הום בוט :)*\nהפנייה הועברה ליועץ מכירות. ניצור קשר בהקדם."
  }
  return ""
}

function stuckOrSalvagedReply(body: string) {
  return salvageReturnPickupAwaitingReply(body) ?? buildProcessingStuckReply()
}

export async function handleLandbotInbound(
  customerId: number,
  conversationId: string,
  turn: UserTurn,
  options?: {
    replyEnabled?: boolean
    phone?: string
    customerName?: string
    /** Prior outbound in the same debounce drain already showed the header. */
    headerAlreadySent?: boolean
    assignedAgentId?: number | null
  }
): Promise<LandbotInboundResult> {
  const replyEnabled = options?.replyEnabled !== false
  const mode: InboundMode = replyEnabled ? "reply" : "shadow"
  const turnSummary = summarizeTurn(turn)
  const trainerResetBypass = isTrainerResetRequest(
    options?.phone,
    turnSummary
  )

  if (
    replyEnabled &&
    !trainerResetBypass &&
    (await isHumanThreadActive(conversationId, options?.assignedAgentId ?? null))
  ) {
    return {
      ok: true,
      agent: "master",
      action: "reply",
      reply: "",
      duplicateSuppressed: true,
      mode,
      skipped: "human_thread_active",
    }
  }

  let customerName = options?.customerName?.trim() || ""
  if (!customerName) {
    const customer = await getCustomer(customerId).catch(() => null)
    customerName = customer?.name?.trim() || ""
  }

  if (replyEnabled) {
    await assignToApiAgent(customerId)
  }

  await ensureSessionMetaFromInbound({
    conversationId,
    customerName: customerName || undefined,
    customerPhone: options?.phone?.trim() || undefined,
  })

  const inactivitySession = await getSessionInactivityState(conversationId)
  if (
    inactivitySession?.inactivity_ping_sent_at ||
    inactivitySession?.inactivity_closed_at
  ) {
    await clearInactivityWatchState(conversationId)
  }

  let body = summarizeTurn(turn)
  let activeTurn = turn

  if (isTrainerPhone(options?.phone)) {
    const resetSplit = splitTrainerResetBody(body)
    if (resetSplit.isReset) {
      await resetTrainerConversation(conversationId)
      const resetReply = buildTrainerResetReply()
      // #region agent log
      debugSessionLog({
        location: "handle-inbound.ts:trainer-reset",
        message: "trainer reset sending",
        hypothesisId: "H1",
        data: {
          conversationId,
          isResetOnly: resetSplit.isResetOnly,
          replyEnabled,
          customerId,
        },
      })
      // #endregion
      await appendTurn({
        conversationId,
        agent: "master",
        userText: resetSplit.isResetOnly ? body : "איפוס",
        assistantText: resetReply,
        action: "reset",
      })
      if (replyEnabled) {
        await sendCustomerText(customerId, resetReply)
      }
      if (!resetSplit.remainder) {
        return {
          ok: true,
          agent: "master",
          reply: "",
          action: "reset",
          mode,
          draft_reply: undefined,
          outbound_header_sent: true,
        }
      }
      body = resetSplit.remainder
      activeTurn = { text: resetSplit.remainder, media: turn.media }
    }
  }

  if (isTrainerPhone(options?.phone) && isTrainerQuestionCommand(body)) {
    const question = stripTrainerQuestionPrefix(body)
    const reply = question
      ? await answerTrainerQuestion({ question, conversationId })
      : TRAINER_QUESTION_EMPTY_HINT

    if (replyEnabled) {
      await sendCustomerText(customerId, reply)
    }

    return {
      ok: true,
      agent: "master",
      reply,
      action: "reply",
      mode,
      draft_reply: reply,
    }
  }

  if (isTrainerPhone(options?.phone) && isTrainerCorrectionCommand(body)) {
    if (replyEnabled) {
      await sendCustomerText(customerId, TRAINER_CORRECTION_ACK)
    }

    const correction = await processTrainerCorrection({
      conversationId,
      correctionText: body,
      customerName: customerName || undefined,
    })

    if (replyEnabled) {
      await sendCustomerText(customerId, TRAINER_CORRECTION_DONE)
      if (correction.sendFixed && correction.fixedReply) {
        await sendCustomerText(customerId, correction.fixedReply)
      }
    }

    return {
      ok: true,
      agent: "master",
      reply: TRAINER_CORRECTION_DONE,
      action: "reply",
      mode,
      draft_reply: correction.fixedReply,
    }
  }

  if (isTrainerPhone(options?.phone) && isTrainerProfileCommand(body)) {
    const reply = (await handleTrainerProfileCommand(body)) ?? buildNeverStuckReply()
    if (replyEnabled) {
      await sendCustomerText(customerId, reply)
    }
    return {
      ok: true,
      agent: "master",
      reply,
      action: "reply",
      mode,
      draft_reply: reply,
    }
  }

  let result: AgentResponse
  let headerAlreadySent = options?.headerAlreadySent ?? false
  const watchdog = startProcessingWatchdog({
    replyEnabled,
    onStuck: async () => {
      const stuckReply = stuckOrSalvagedReply(body)
      await appendTurn({
        conversationId,
        agent: "faq",
        userText: body,
        assistantText: stuckReply,
        action: "reply",
      })
      await sendCustomerText(customerId, stuckReply)
    },
  })

  try {
    result = await runCustomerConversation(conversationId, activeTurn, {
      customerName: customerName || undefined,
      phone: options?.phone?.trim() || undefined,
      priorityApiEnabled: replyEnabled,
      persistTurn: !replyEnabled,
      onPriorityApiCall: replyEnabled
        ? async () => {
            await sendCustomerText(customerId, PRIORITY_API_PREMESSAGE)
            await recordProactiveAssistantMessage({
              conversationId,
              assistantText: PRIORITY_API_PREMESSAGE,
              action: "reply",
            }).catch((error) => {
              console.warn("[handle-inbound] failed to persist priority pre-message", error)
            })
            headerAlreadySent = true
            watchdog.markReplySent()
          }
        : undefined,
    })

    while (replyEnabled) {
      const mergedTurn = await coalesceTrailingBufferedTurn(conversationId, activeTurn)
      if (summarizeTurn(mergedTurn) === summarizeTurn(activeTurn)) break
      activeTurn = mergedTurn
      body = summarizeTurn(activeTurn)
      result = await runCustomerConversation(conversationId, activeTurn, {
        customerName: customerName || undefined,
        phone: options?.phone?.trim() || undefined,
        priorityApiEnabled: replyEnabled,
        persistTurn: false,
        onPriorityApiCall: undefined,
      })
    }

    if (replyEnabled) {
      await appendTurn({
        conversationId,
        agent: result.agent ?? "faq",
        userText: body,
        assistantText: result.reply ?? "",
        action: result.action ?? "reply",
      })
    }
  } catch (error) {
    console.error("[handle-inbound] runCustomerConversation failed", error)
    result = {
      ok: true,
      agent: "faq",
      reply: buildNeverStuckReply(),
      action: "reply",
    }
  }

  let draftReply = outboundReply(result)
  if (
    replyEnabled &&
    !draftReply &&
    !result.duplicateSuppressed &&
    (result.action === "reply" || result.action === "shipping")
  ) {
    draftReply = stuckOrSalvagedReply(body)
    result = { ...result, reply: draftReply }
  }

  if (
    replyEnabled &&
    !draftReply &&
    result.duplicateSuppressed &&
    (result.action === "reply" || result.action === "shipping")
  ) {
    draftReply = stuckOrSalvagedReply(body)
    result = { ...result, reply: draftReply, duplicateSuppressed: false }
  }

  const rawOutbound =
    result.replies?.filter((text) => text.trim()) ??
    (draftReply ? [draftReply] : [])
  const { messages: outboundMessages, headerSent: outboundHeaderSent } =
    formatOutboundMessages(rawOutbound, { headerAlreadySent })

  if (replyEnabled && !watchdog.stuckAlreadySent()) {
    // #region agent log
    debugSessionLog({
      location: "handle-inbound.ts:outbound",
      message: "sending outbound messages",
      hypothesisId: "H2",
      data: {
        conversationId,
        count: outboundMessages.length,
        action: result.action,
        preview: outboundMessages[0]?.slice(0, 60),
      },
    })
    // #endregion
    for (const text of outboundMessages) {
      await sendCustomerText(customerId, text)
    }
    if (outboundMessages.length > 0) {
      watchdog.markReplySent()
    }

    if (result.action === "human_sales" || result.action === "human_service") {
      await clearInactivityWatchState(conversationId)
      const human = pickHumanAgentId(result.action, customerId)
      if (human) await assignToHuman(customerId, human)
      else await unassignCustomer(customerId)
      await recordHumanAgentActivity(conversationId)
    } else if (outboundMessages.length > 0) {
      await releaseHumanThread(conversationId)
      const lastOutbound = outboundMessages[outboundMessages.length - 1] ?? ""
      if (
        shouldSkipInactivityForHumanWait({
          lastAction: result.action,
          lastAssistantText: lastOutbound,
        })
      ) {
        await clearInactivityWatchState(conversationId)
      } else {
        const history = await getHistory(conversationId)
        if (shouldSuppressInactivityWatch(history)) {
          await clearInactivityWatchState(conversationId)
        } else {
        const session = await getSessionInactivityState(conversationId)
        const watchAssistantAt = session?.last_assistant_at
        if (watchAssistantAt) {
          const watchInput = {
            conversationId,
            customerId,
            customerName: customerName || undefined,
            customerPhone:
              options?.phone?.trim() ||
              (typeof session.customer_phone === "string"
                ? session.customer_phone.trim()
                : undefined),
            watchAssistantAt: String(watchAssistantAt),
          }
          after(async () => {
            try {
              await runInactivityPipeline(watchInput)
            } catch (error) {
              console.error("[inactivity-watch] pipeline failed", error)
            }
          })
        }
        }
      }
    }
  } else {
    await logShadowTurn({
      conversationId,
      customerId,
      phone: options?.phone?.trim() || "",
      userText: summarizeTurn(turn),
      result,
      draftReply,
      replied: false,
    })
  }

  return {
    ...result,
    mode,
    draft_reply: outboundMessages[0] || draftReply || undefined,
    outbound_header_sent: outboundHeaderSent || headerAlreadySent,
  }
}
