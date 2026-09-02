import { CUSTOMER_HEADER, type HistoryMessage } from "@/lib/agents/types"
import { isInactivityAssistantMessage } from "@/lib/agents/inactivity"
import { isExplicitHumanRequest } from "@/lib/agents/order-lookup"

import {
  isPostPurchaseDissatisfaction,
  mentionsReturnIntent,
} from "@/lib/agents/inquiry-intent"
import { buildReturnsPortalUrl } from "@/lib/agents/policy-subjects"

/** Customer unhappy after delivery without defect wording — FAQ return/exchange policy first. */
export function isDissatisfactionWithoutDefect(body: string) {
  return isPostPurchaseDissatisfaction(body)
}

export const DISSATISFACTION_SALES_OFFER_MARKER =
  "אשמח להעביר את השיחה לנציג מכירות"

export const DISSATISFACTION_PORTAL_REFERRAL_MARKER =
  "יש לפתוח בקשת החזרה דרך הפורטל שלנו"

export const DISSATISFACTION_RESCUE_MARKER = "יש שתי אפשרויות"

export type DissatisfactionRescueStage = "sales_offer" | "portal_referred"

export function getDissatisfactionRescueStage(
  history: HistoryMessage[]
): DissatisfactionRescueStage | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    if (message.content.includes(DISSATISFACTION_PORTAL_REFERRAL_MARKER)) {
      return "portal_referred"
    }
    if (
      message.content.includes(DISSATISFACTION_SALES_OFFER_MARKER) ||
      message.content.includes(DISSATISFACTION_RESCUE_MARKER)
    ) {
      return "sales_offer"
    }
    return null
  }
  return null
}

export function isDissatisfactionRescuePending(history: HistoryMessage[]) {
  return getDissatisfactionRescueStage(history) != null
}

function wantsSalesConsultation(body: string) {
  const text = body.trim()
  if (!text) return false
  if (/^(?:כן|בטח|יאללה|אשמח|בסדר|מעולה|ok|yes|👍)(?:[\s,.!?]|$)/i.test(text)) {
    return true
  }
  return /מכירות|יועץ|דגם\s+אחר|שטיח\s+אחר|מתאים\s+יותר|לנסות\s+דגם|^החלפה(?:[\s,.!?]|$)/i.test(
    text
  )
}

function insistsOnReturn(body: string) {
  const text = body.trim()
  if (!text) return false
  if (mentionsReturnIntent(text)) return true
  if (/^(?:לא|לא\s+תודה|עזוב)(?:[\s,.!?]|$)/i.test(text)) return true
  return /(?:רוצ(?:ה|ים|ות)\s+(?:ל)?(?:ה)?החזיר|(?:ל)?החזיר|החזרה|זיכוי|ביטול|לא\s+מעוניין(?:\s+ב)?(?:יועץ|מכירות|דגם))/i.test(
    text
  )
}

export type DissatisfactionRescueFollowUp = "sales" | "portal" | "service"

export function resolveDissatisfactionRescueFollowUp(
  body: string,
  stage: DissatisfactionRescueStage
): DissatisfactionRescueFollowUp | null {
  if (stage === "sales_offer") {
    if (wantsSalesConsultation(body)) return "sales"
    if (insistsOnReturn(body)) return "portal"
    return null
  }

  if (isExplicitHumanRequest(body) || isReturnHumanEscalation(body)) {
    return "service"
  }

  return null
}

function isReturnHumanEscalation(body: string) {
  const text = body.trim()
  if (!text) return false
  return (
    /(?:עדיין\s+(?:רוצ(?:ה|ים|ות)|צריך|מעוניין)|(?:ת|ת)?עביר(?:ו)?\s+(?:לי\s+)?(?:ל)?(?:נציג|שירות)|נציג\s+שירות|שירות\s+לקוחות|אדם\s+אמיתי|לדבר\s+ע(?:ם|ם)\s+(?:מישהו|נציג))/i.test(
      text
    ) ||
    (/^(?:כן|בטח|יאללה|אשמח|בסדר)(?:[\s,.!?]|$)/i.test(text) &&
      /(?:נציג|שירות|אדם)/i.test(text))
  )
}

/** Opening: exchange + return options, sales advisor offer, portal for returns. */
export function buildDissatisfactionRescueReply(phone?: string | null) {
  const portalUrl = buildReturnsPortalUrl(phone)
  return `${CUSTOMER_HEADER}
היי! 👋

קיבלנו, ${DISSATISFACTION_RESCUE_MARKER}:

1. *החלפה* — ניתן להחליף לשטיח אחר שיתאים יותר, אם צריכים יעוץ להתאמה ${DISSATISFACTION_SALES_OFFER_MARKER}.
2. *החזרה וביטול* — אפשר להחזיר ב*סניפי הרשת*, או באמצעות שליח (בתשלום לפי גודל השטיח). בכל מקרה יש לפתוח בקשת החזרה/ביטול בפורטל — גם כשמחזירים בסניף; איסוף בבית דרך שליח בתשלום.
בכל מקרה ${DISSATISFACTION_PORTAL_REFERRAL_MARKER}:
${portalUrl}

איך תרצו להמשיך?☺️`
}

/** Strip LLM drift on dissatisfaction rescue replies. */
export function sanitizeDissatisfactionRescueReply(reply: string) {
  let text = reply
  text = text.replace(/מצב לא נעים[^\n]*\n?/gi, "")
  text = text.replace(/[0-9]️⃣/g, "")
  return text
}

/** After the customer insists on returning — portal only for cancellation/refund. */
export function buildDissatisfactionRescuePortalReply(phone?: string | null) {
  const portalUrl = buildReturnsPortalUrl(phone)
  return `${CUSTOMER_HEADER}
אין בעיה — ${DISSATISFACTION_PORTAL_REFERRAL_MARKER}:
${portalUrl}`
}
