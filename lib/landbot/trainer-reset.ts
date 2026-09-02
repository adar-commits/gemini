import { CUSTOMER_HEADER } from "@/lib/agents/types"
import { resetAgentSession } from "@/lib/landbot/resolve-customer"
import { isTrainerPhone } from "@/lib/landbot/trainer"

const TRAINER_RESET_PHRASE = "איפוס"

function normalizeTrainerText(text: string) {
  return text
    .replace(/[\u200e\u200f\u202a-\u202e\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** Exact trainer-only reset command — not "התחלה" or other menu resets. */
export function isTrainerResetCommand(text: string) {
  return splitTrainerResetBody(text).isResetOnly
}

/** Trainer reset must run even when a human rep owns the thread (testing / recovery). */
export function isTrainerResetRequest(
  phone: string | null | undefined,
  text: string
) {
  if (!isTrainerPhone(phone)) return false
  return splitTrainerResetBody(text).isReset
}

/** Reset on its own line at the start of a burst — remainder is processed after reset. */
export function splitTrainerResetBody(text: string) {
  const trimmed = text.trim()
  if (!trimmed) {
    return { isReset: false, isResetOnly: false, remainder: "" }
  }

  if (normalizeTrainerText(trimmed) === TRAINER_RESET_PHRASE) {
    return { isReset: true, isResetOnly: true, remainder: "" }
  }

  const lines = trimmed.split(/\n+/).map((line) => line.trim()).filter(Boolean)
  if (lines[0] === TRAINER_RESET_PHRASE) {
    return {
      isReset: true,
      isResetOnly: lines.length === 1,
      remainder: lines.slice(1).join("\n").trim(),
    }
  }

  return { isReset: false, isResetOnly: false, remainder: trimmed }
}

export function buildTrainerResetReply() {
  return `${CUSTOMER_HEADER}\nהשיחה אופסה. אפשר להתחיל מחדש.`
}

export async function resetTrainerConversation(conversationId: string) {
  await resetAgentSession(conversationId)
}
