import {
  normalizeMessageText,
  type ConversationTail,
} from "@/lib/agents/memory"
import type { HistoryMessage } from "@/lib/agents/types"

export const TRAINER_CORRECTION_PREFIX = "לתיקון:"
export const TRAINER_QUESTION_PREFIX = "שאלה:"

/** Trainer-only correction command — message must start with this prefix. */
export function isTrainerCorrectionCommand(text: string) {
  return normalizeMessageText(text).startsWith(TRAINER_CORRECTION_PREFIX)
}

/** Trainer-only direct AI chat — message must start with this prefix. */
export function isTrainerQuestionCommand(text: string) {
  return normalizeMessageText(text).startsWith(TRAINER_QUESTION_PREFIX)
}

export function stripTrainerCorrectionPrefix(text: string) {
  return text.trim().replace(/^לתיקון:\s*/, "").trim()
}

export function stripTrainerQuestionPrefix(text: string) {
  return text.trim().replace(/^שאלה:\s*/, "").trim()
}

/**
 * Send the corrected bot reply only when the last turn before this correction
 * was from the bot (trainer is fixing a bot reply, not mid-question).
 * Also skip if the live tail shows a newer non-correction user message.
 */
export function shouldSendTrainerFixedPreview(
  history: HistoryMessage[],
  correctionBody: string,
  tail?: ConversationTail
) {
  const correctionNorm = normalizeMessageText(correctionBody)
  const historyExclCorrection = history.filter((message) => {
    if (message.role !== "user") return true
    return normalizeMessageText(message.content) !== correctionNorm
  })

  const lastBeforeCorrection =
    historyExclCorrection[historyExclCorrection.length - 1]
  if (lastBeforeCorrection?.role !== "assistant") return false

  if (tail?.latestRole === "user") {
    const latest = tail.latestContent?.trim() ?? ""
    if (
      latest &&
      !latest.startsWith(TRAINER_CORRECTION_PREFIX) &&
      normalizeMessageText(latest) !== correctionNorm
    ) {
      return false
    }
  }

  return true
}
