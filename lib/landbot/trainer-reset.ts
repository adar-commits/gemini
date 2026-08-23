import { CUSTOMER_HEADER } from "@/lib/agents/types"
import { resetAgentSession } from "@/lib/landbot/resolve-customer"

const TRAINER_RESET_PHRASE = "תאפס את השיחה"

function normalizeTrainerText(text: string) {
  return text.replace(/\s+/g, " ").trim()
}

/** Exact trainer-only reset command — not "התחלה" or other menu resets. */
export function isTrainerResetCommand(text: string) {
  return normalizeTrainerText(text) === TRAINER_RESET_PHRASE
}

export function buildTrainerResetReply() {
  return `${CUSTOMER_HEADER}\nהשיחה אופסה. אפשר להתחיל מחדש.`
}

export async function resetTrainerConversation(conversationId: string) {
  await resetAgentSession(conversationId)
}
