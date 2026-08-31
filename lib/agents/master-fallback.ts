import type { AgentId, HistoryMessage } from "@/lib/agents/types"
import { hasImmediateBusinessAsk, isCasualGreeting } from "@/lib/agents/greeting"
import { guessMasterRoute } from "@/lib/agents/route-intent"
import {
  isColloquialQuizAffirmation,
  isIntakeTopicPivot,
  isSalesConsultationTrigger,
  isSalesQuizContext,
  mentionsPetInText,
} from "@/lib/agents/sales-intake"
import { isConversationClosing } from "@/lib/agents/conversation-close"
import { isCustomerServiceOpener } from "@/lib/agents/customer-service-opener"
import {
  isFaqTopicSwitch,
  isSalesTopicSwitch,
  isServiceTopicSwitch,
} from "@/lib/agents/topic-switch"
import { isDigitalDocumentRequest } from "@/lib/agents/digital-document-flow"
import {
  isInventoryQuestionWithContext,
  isSkuRequestPending,
  isActiveInventoryThread,
} from "@/lib/agents/inventory-lookup"
import { hasProductUrl } from "@/lib/agents/product-handoff"
import {
  isDeliverySchedulingRequest,
  isShippingPolicyQuestion,
  isShippingStatusQuestion,
} from "@/lib/agents/shipping"
import { isHumanHandoffPending, isOffTopicQuestion } from "@/lib/agents/off-topic"
import { isDissatisfactionWithoutDefect } from "@/lib/agents/dissatisfaction"
import { buildUncertainHandoffReply } from "@/lib/agent-core/fallbacks"

export type MasterFallbackKind = "sales_intake" | "handoff_offer"

export type MasterFallbackResolution = {
  kind: MasterFallbackKind
}

const HOM_BUSINESS_RE =
  /שטיח|פוף|תמונ(?:ה|ת)|כרית|אביזר|סלון|חדר|מרפס|חצר|גינ(?:ה|ה)|תקציב|מחיר|הזמנ(?:ה|ת)|משלוח|סניף|מלאי|דגם|קנ(?:י|י)ה|רכישה|החזר|תשלום|נציג|יועץ|עיצוב|בעלי\s+חיים|חתול|כלב/i

export function isLikelyQuizAnswer(body: string, history: HistoryMessage[]) {
  const text = body.trim()
  if (!text || text.length > 120) return false
  if (isConversationClosing(text)) return false
  if (isIntakeTopicPivot(text, history)) return false
  if (
    text.length <= 6 &&
    !INTAKE_SHORT_ANSWER_LIKE.test(text) &&
    !isColloquialQuizAffirmation(text) &&
    !mentionsPetInText(text)
  ) {
    return false
  }
  if (isColloquialQuizAffirmation(text)) return true
  if (mentionsPetInText(text)) return true
  if (INTAKE_SHORT_ANSWER_LIKE.test(text)) return true
  if (text.length <= 60 && /(?:סלון|חדר|מרפס|תקציב|יוקרתי|מודרני|כפרי|\d)/i.test(text)) {
    return true
  }
  return text.split(/\s+/).length <= 8
}

const INTAKE_SHORT_ANSWER_LIKE =
  /^(?:סלון|חדר\s+שינה|מסדרון|מרפס(?:ה|ת)?|חצר|גינ(?:ה|ה)?|זוג|משפחה|יוקרתי|מודרני|כפרי|לא\s+יודע(?:ת)?|לא\s+בטוח(?:ה)?)(?:[\s,.!?]*|$)/iu

function hasClearRoute(body: string, history: HistoryMessage[]) {
  if (isCustomerServiceOpener(body)) return true
  if (isServiceTopicSwitch(body)) return true
  if (isFaqTopicSwitch(body)) return true
  if (isSalesTopicSwitch(body)) return true
  if (isShippingPolicyQuestion(body) || isShippingStatusQuestion(body)) return true
  if (isConversationClosing(body)) return true
  if (isDissatisfactionWithoutDefect(body)) return true
  if (isOffTopicQuestion(body)) return true
  if (isCasualGreeting(body)) return true
  if (hasImmediateBusinessAsk(body)) return true
  if (isDigitalDocumentRequest(body)) return true
  if (isDeliverySchedulingRequest(body)) return true
  if (isInventoryQuestionWithContext(body, history)) return true
  if (hasProductUrl(body) && (isSkuRequestPending(history) || isActiveInventoryThread(history))) {
    return true
  }
  if (guessMasterRoute(body)) return true
  if (isSalesConsultationTrigger(body)) return true
  if (mentionsPetInText(body)) return true
  if (isHumanHandoffPending(history)) return true
  return false
}

function isOddUnrelatedMessage(
  body: string,
  history: HistoryMessage[],
  lastAgent: AgentId | null
) {
  const text = body.trim()
  if (!text || text.length < 6) return false
  if (isSalesQuizContext(history, lastAgent)) return false
  if (HOM_BUSINESS_RE.test(text)) return false
  if (hasClearRoute(text, history)) return false

  const words = text.split(/\s+/).filter(Boolean)
  if (words.length >= 4 && text.length >= 12) return true
  if (text.length >= 40) return true
  return false
}

/**
 * When master routing is unclear: stay in sales quiz if compatible, else offer human service.
 */
export function resolveMasterFallback(
  body: string,
  history: HistoryMessage[],
  lastAgent: AgentId | null
): MasterFallbackResolution | null {
  const text = body.trim()
  if (!text) return null
  if (hasClearRoute(text, history)) return null

  if (isSalesQuizContext(history, lastAgent)) {
    if (!isIntakeTopicPivot(text, history) && isLikelyQuizAnswer(text, history)) {
      return { kind: "sales_intake" }
    }
  }

  if (
    mentionsPetInText(text) ||
    (isSalesConsultationTrigger(text) && !isOddUnrelatedMessage(text, history, lastAgent))
  ) {
    return { kind: "sales_intake" }
  }

  if (isOddUnrelatedMessage(text, history, lastAgent)) {
    return { kind: "handoff_offer" }
  }

  return null
}

export function buildMasterConfusedReply(userText?: string) {
  return buildUncertainHandoffReply(userText)
}

export function isStrictMisunderstandingReply(reply: string) {
  const text = reply.trim()
  return (
    /לא\s+הצלחתי\s+להבין\s+א(?:ת|ת)\s+שאל/i.test(text) ||
    (/לא\s+ה(?:בנ|צל)/i.test(text) &&
      /(?:נס(?:ה|י)\s+שוב|נסח(?:\/י)?\s+שוב|לא\s+ברור)/i.test(text))
  )
}
