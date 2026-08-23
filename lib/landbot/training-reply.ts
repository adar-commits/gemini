import { runMasterConversation } from "@/lib/agents/run-agent"
import type { UserTurn } from "@/lib/agents/user-turn"
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

export async function sendTrainingReply(input: TrainingReplyInput) {
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
  if (input.reset) {
    await resetAgentSession(conversationId)
  }

  const customer = await getCustomer(customerId).catch(() => null)
  const turn: UserTurn = { text: userText, media: [] }
  const result = await runMasterConversation(conversationId, turn, {
    customerName: customer?.name?.trim() || undefined,
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
