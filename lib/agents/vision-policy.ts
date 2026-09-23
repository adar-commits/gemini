import type { AgentId, HistoryMessage } from "@/lib/agents/types"
import {
  isServiceLookupContext,
  isOrderNumberRequestPending,
  isServiceOrderIdentificationPending,
} from "@/lib/agents/order-lookup"
import { isPostPurchaseAlternateSizeThread } from "@/lib/agents/post-purchase-alt-size"
import {
  isServicePhotoAnalysisContext,
  shouldAckSalesRoomPhotoWithoutVision,
  turnHasCustomerImage,
} from "@/lib/agents/sales-intake"
import { summarizeTurn, type UserTurn } from "@/lib/agents/user-turn"

/** Token-conscious vision: attach images only when analysis helps the customer. */
export type VisionPolicy = {
  attachCurrentTurnImages: boolean
  allowPriorImageReinject: boolean
}

const NO_VISION: VisionPolicy = {
  attachCurrentTurnImages: false,
  allowPriorImageReinject: false,
}

const PRIOR_IMAGE_REFERENCE_RE =
  /(?:כמו\s+ב(?:תמונה|צילום)|בתמונה\s+ש(?:שלחתי|צירפתי)|מה(?:ש)?(?:ראית|בתמונה))/i

/** Receipt / invoice / payment screenshot — order identification, not sales room decor. */
export function isOrderDocumentScreenshotTurn(body: string) {
  if (!/\[media:image:/i.test(body)) return false
  const textOnly = body.replace(/\[media:image:[^\]]+\]/gi, "").trim()
  return (
    /(?:קבלה|חשבונית|invoice|receipt|מסמך\s+דיגיטלי|documents\.carpetshop|tracking\.carpetshop)/i.test(
      textOnly
    ) ||
    /\b(?:SO|IN|OV|RC)\d{4,}/i.test(textOnly) ||
    /(?:הזמנה|טלפון|תשלום|payment|order\s*#|מס(?:'|׳)?\s*הזמנה)/i.test(textOnly)
  )
}

/**
 * When true, attach the customer's image(s) to the LLM request (~1.5K visual tokens each).
 * Sales room photos stay text-only (pre-turn ack or stripped here).
 */
export function shouldAnalyzeCustomerImage(input: {
  history: HistoryMessage[]
  turn: UserTurn
  lastAgent: AgentId | null
}): boolean {
  if (!turnHasCustomerImage(input.turn)) return false

  const body = summarizeTurn(input.turn)
  const { history, lastAgent } = input

  if (shouldAckSalesRoomPhotoWithoutVision(history, input.turn, lastAgent)) {
    return false
  }
  if (isPostPurchaseAlternateSizeThread(history, body)) {
    return false
  }
  if (isServicePhotoAnalysisContext(history, body)) {
    return true
  }
  if (isOrderNumberRequestPending(history)) {
    return true
  }
  if (isServiceOrderIdentificationPending(history)) {
    return true
  }
  if (isServiceLookupContext(history, lastAgent)) {
    return true
  }
  if (isOrderDocumentScreenshotTurn(body)) {
    return true
  }

  return false
}

export function resolveVisionPolicy(input: {
  history: HistoryMessage[]
  turn: UserTurn
  lastAgent: AgentId | null
}): VisionPolicy {
  const attachCurrentTurnImages = shouldAnalyzeCustomerImage(input)

  const allowPriorImageReinject =
    !attachCurrentTurnImages &&
    PRIOR_IMAGE_REFERENCE_RE.test(input.turn.text.trim()) &&
    (isServicePhotoAnalysisContext(input.history, summarizeTurn(input.turn)) ||
      isServiceLookupContext(input.history, input.lastAgent) ||
      isOrderNumberRequestPending(input.history) ||
      isServiceOrderIdentificationPending(input.history))

  if (!attachCurrentTurnImages && !allowPriorImageReinject) {
    return NO_VISION
  }

  return { attachCurrentTurnImages, allowPriorImageReinject }
}

/** Strip image parts from a turn while keeping text markers for thread context. */
export function turnWithoutImages(turn: UserTurn): UserTurn {
  return {
    text: turn.text,
    media: turn.media.filter((part) => part.kind !== "image"),
  }
}
