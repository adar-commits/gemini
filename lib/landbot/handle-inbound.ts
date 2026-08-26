import { runMasterConversation } from "@/lib/agents/run-agent"
import { appendTurn, clearInactivityWatchState, getSessionInactivityState } from "@/lib/agents/memory"
import type { UserTurn } from "@/lib/agents/user-turn"
import { summarizeTurn } from "@/lib/agents/user-turn"
import {
  assignToApiAgent,
  assignToHuman,
  getCustomer,
  sendCustomerText,
  unassignCustomer,
} from "@/lib/landbot/client"
import { pickHumanAgentId } from "@/lib/landbot/human-agents"
import { logShadowTurn } from "@/lib/landbot/shadow-log"
import {
  buildTrainerResetReply,
  isTrainerResetCommand,
  resetTrainerConversation,
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
import { after } from "next/server"
import type { AgentResponse } from "@/lib/agents/types"

export type InboundMode = "reply" | "shadow"

export type LandbotInboundResult = AgentResponse & {
  mode: InboundMode
  draft_reply?: string
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

export async function handleLandbotInbound(
  customerId: number,
  conversationId: string,
  turn: UserTurn,
  options?: { replyEnabled?: boolean; phone?: string; customerName?: string }
): Promise<LandbotInboundResult> {
  const replyEnabled = options?.replyEnabled !== false
  const mode: InboundMode = replyEnabled ? "reply" : "shadow"

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
    inactivitySession?.inactivity_ping_sent_at &&
    !inactivitySession.inactivity_closed_at
  ) {
    await clearInactivityWatchState(conversationId)
  }

  const body = summarizeTurn(turn)

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

  if (
    isTrainerPhone(options?.phone) &&
    isTrainerResetCommand(body)
  ) {
    await resetTrainerConversation(conversationId)
    const reply = buildTrainerResetReply()
    await appendTurn({
      conversationId,
      agent: "master",
      userText: body,
      assistantText: reply,
      action: "reset",
    })
    if (replyEnabled) {
      await sendCustomerText(customerId, reply)
    }
    return {
      ok: true,
      agent: "master",
      reply,
      action: "reset",
      mode,
      draft_reply: reply,
    }
  }

  const result = await runMasterConversation(conversationId, turn, {
    customerName: customerName || undefined,
    phone: options?.phone?.trim() || undefined,
  })
  const draftReply = outboundReply(result)

  if (replyEnabled) {
    if (draftReply) {
      await sendCustomerText(customerId, draftReply)
    }

    if (result.action === "human_sales" || result.action === "human_service") {
      const human = pickHumanAgentId(result.action, customerId)
      if (human) await assignToHuman(customerId, human)
      else await unassignCustomer(customerId)
    } else if (draftReply) {
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
    draft_reply: draftReply || undefined,
  }
}
