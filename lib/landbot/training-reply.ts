import { runMasterConversation } from "@/lib/agents/run-agent"
import type { UserTurn } from "@/lib/agents/user-turn"
import {
  getConversationTail,
  normalizeMessageText,
} from "@/lib/agents/memory"
import { assignToApiAgent, getCustomer, sendCustomerText } from "@/lib/landbot/client"
import {
  resetAgentSession,
  resolveTrainerCustomerId,
} from "@/lib/landbot/resolve-customer"
import { trainerPhone } from "@/lib/landbot/trainer"

export type TrainingReplyInput = {
  userText: string
  phone?: string
  note?: string
  reset?: boolean
  previewLabel?: string
  force?: boolean
}

export type TrainingReplyResult = {
  ok: boolean
  skipped?: boolean
  reason?: string
  phone?: string
  customerId?: number
  conversationId?: string
  agent?: string
  action?: string
  sent?: string
  latest_user_message?: string | null
}

function formatTrainingMessage(input: {
  reply: string
  userText: string
  note?: string
  previewLabel?: string
}) {
  const parts: string[] = []
  if (input.previewLabel?.trim()) {
    parts.push(`*${input.previewLabel.trim()}*`)
  } else if (input.note?.trim()) {
    parts.push(`*תצוגה אחרי תיקון:* ${input.note.trim()}`)
  } else {
    parts.push("*תצוגה אחרי תיקון*")
  }
  parts.push(`שאלה: ${input.userText.trim()}`)
  parts.push("")
  parts.push(input.reply.trim())
  return parts.join("\n")
}

function shouldSkipTrainingPreview(input: {
  latestUserMessage: string | null
  latestRole: "user" | "assistant" | null
  latestContent: string | null
  userText: string
}) {
  const target = normalizeMessageText(input.userText)
  const latestUser = input.latestUserMessage
    ? normalizeMessageText(input.latestUserMessage)
    : null

  if (latestUser && latestUser !== target) {
    return {
      skip: true,
      reason:
        "Conversation has a newer or different latest user message — not sending training preview.",
    }
  }

  if (input.latestRole === "assistant") {
    return {
      skip: true,
      reason:
        "Latest conversation turn is already a bot reply — not sending training preview.",
    }
  }

  if (input.latestContent?.includes("תצוגה אחרי תיקון")) {
    return {
      skip: true,
      reason: "A training preview was already sent recently.",
    }
  }

  return { skip: false as const }
}

export async function sendTrainingReply(
  input: TrainingReplyInput
): Promise<TrainingReplyResult> {
  const phone = input.phone?.trim() || trainerPhone()
  const userText = input.userText.trim()
  if (!userText) {
    throw new Error("userText is required")
  }

  const customerId = await resolveTrainerCustomerId(phone)
  if (!customerId) {
    throw new Error(`No Landbot customer found for trainer phone ${phone}`)
  }

  const conversationId = String(customerId)
  const tail = await getConversationTail(conversationId)

  if (!input.force) {
    const guard = shouldSkipTrainingPreview({
      latestUserMessage: tail.latestUserMessage,
      latestRole: tail.latestRole,
      latestContent: tail.latestContent,
      userText,
    })
    if (guard.skip) {
      return {
        ok: false,
        skipped: true,
        reason: guard.reason,
        phone,
        customerId,
        conversationId,
        latest_user_message: tail.latestUserMessage,
      }
    }
  }

  if (input.reset) {
    await resetAgentSession(conversationId)
  }

  const customer = await getCustomer(customerId).catch(() => null)
  const turn: UserTurn = { text: userText, media: [] }
  const result = await runMasterConversation(conversationId, turn, {
    customerName: customer?.name?.trim() || undefined,
    preview: true,
  })

  const replyBody =
    result.reply ||
    (result.action === "human_service"
      ? "*הום בוט :)*\nהפנייה הועברה לנציג שירות. ניצור קשר בהקדם."
      : result.action === "human_sales"
        ? "*הום בוט :)*\nהפנייה הועברה ליועץ מכירות. ניצור קשר בהקדם."
        : "")

  if (!replyBody) {
    throw new Error(`Agent produced no customer reply (action=${result.action})`)
  }

  const outbound = formatTrainingMessage({
    reply: replyBody,
    userText,
    note: input.note,
    previewLabel: input.previewLabel,
  })

  await assignToApiAgent(customerId)
  await sendCustomerText(customerId, outbound)

  return {
    ok: true,
    phone,
    customerId,
    conversationId,
    agent: result.agent,
    action: result.action,
    sent: outbound,
  }
}
