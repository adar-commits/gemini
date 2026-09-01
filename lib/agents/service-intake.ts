import type { HistoryMessage } from "@/lib/agents/types"
import { CUSTOMER_HEADER } from "@/lib/agents/types"
import {
  classifyPostPurchaseCase,
  type PostPurchaseCaseKind,
  isActiveReturnExchangePickupCase,
} from "@/lib/agents/inquiry-intent"
import {
  activeIntentConfirmKind,
  isPostPurchaseIntentConfirmPending,
} from "@/lib/agents/intent-confirmation"
import { extractOrderNumber } from "@/lib/agents/order-lookup"

export type ServiceIntake = {
  issueKind: PostPurchaseCaseKind | null
  orderNumber?: string
  waitDuration?: string
  customerGoal?: string
}

const SERVICE_SUMMARY_PENDING_RE =
  /(?:אז\s+)?לסיכום|האם\s+ז(?:ה|ו)\s+נכון\s+עד\s+כה|אני\s+צודק\s*\?/i

const WAIT_DURATION_RE =
  /(?:כבר|מ(?:זה|על)?|במשך|כ(?:\"|״|')?ל)\s*(?:כ)?(?:\"|״|')?(?:שבוע(?:יים|יים|)?|יום(?:יים|)?|חודש(?:יים|)?|\d+\s+(?:ימים|שבועות|חודשים))|(?:שבוע(?:יים|יים|)|יום(?:יים|)?)\s+(?:ש(?:אני|אנחנו)|(?:ש)?(?:מ)?(?:חכ(?:ה|ים|ות)|ממתינ(?:ה|ים|ות)?))/i

const CUSTOMER_GOAL_RE =
  /(?:רוצ(?:ה|ים|ות)|(?:מ)?(?:חכ(?:ה|ים|ות)|ממתינ(?:ה|ים|ות)?)|(?:מ)?(?:צ(?:ריך|ריכ(?:ה|ים|ות)?|פ(?:ה|ים|ות)?))|(?:מ)?(?:בקש(?:ה|ת)?|מעונ(?:יין|יינ(?:ת|ים|ות)?)))\s*(?:ל)?(?:ש)?(?:יאספ(?:ו|u)|(?:ל)?(?:איסוף|לאסוף)|(?:ל)?(?:דעת|עדכון|סטטוס|לזרז|לזרז\s+א(?:ת|ת)?)|(?:ש)?(?:נציג|יועץ))/i

const ISSUE_LABELS: Record<PostPurchaseCaseKind, string> = {
  return_pickup_pending:
    "בקשת החזרה כבר הוגשה — ממתינים לאיסוף שליח מהבית (לפני זיכוי)",
  return_request: "בקשת החזרה",
  exchange_request: "בקשת החלפה",
  defect: "פגם / בעיה במוצר",
  dissatisfaction: "אי-שביעות רצון מהמוצר",
  missing_item: "פריט חסר בהזמנה",
  preorder_delay: "עיכוב בהזמנה מוקדמת",
}

function recentUserText(history: HistoryMessage[], body: string) {
  const parts = history
    .filter((message) => message.role === "user")
    .slice(-6)
    .map((message) => message.content.trim())
  parts.push(body.trim())
  return parts.filter(Boolean).join("\n")
}

function extractWaitDuration(text: string) {
  const weekMatch = text.match(/(?:כבר\s+)?(?:כל\s+)?שבוע(?:יים|יים|)?/i)
  if (weekMatch) return weekMatch[0].trim().slice(0, 60)

  const dayMatch = text.match(/(?:כבר\s+)?(?:יום(?:יים|)?|\d+\s+ימים)/i)
  if (dayMatch) return dayMatch[0].trim().slice(0, 60)

  const match = text.match(WAIT_DURATION_RE)
  return match?.[0]?.trim().slice(0, 60)
}

function extractCustomerGoal(text: string, kind: PostPurchaseCaseKind | null) {
  if (kind === "return_pickup_pending") {
    if (/(?:ל)?(?:זרז|לזרז)/i.test(text)) return "לזרז את האיסוף / לקבל עדכון"
    if (/(?:סטטוס|עדכון|מה\s+(?:קורה|המצב))/i.test(text)) {
      return "עדכון על סטטוס האיסוף"
    }
    return "לתאם / לזרז איסוף מהבית לצורך החזרה"
  }

  const match = text.match(CUSTOMER_GOAL_RE)
  if (match) return match[0].trim().slice(0, 80)
  return undefined
}

function resolveIssueKind(history: HistoryMessage[], body: string): PostPurchaseCaseKind | null {
  return (
    activeIntentConfirmKind(history) ??
    classifyPostPurchaseCase(body) ??
    classifyPostPurchaseCase(recentUserText(history, ""))
  )
}

export function extractServiceIntake(
  history: HistoryMessage[],
  body: string
): ServiceIntake {
  const corpus = recentUserText(history, body)
  const issueKind = resolveIssueKind(history, body)
  const orderNumber =
    extractOrderNumber(body) ??
    extractOrderNumber(corpus) ??
    undefined

  return {
    issueKind,
    orderNumber,
    waitDuration: extractWaitDuration(corpus),
    customerGoal: extractCustomerGoal(corpus, issueKind),
  }
}

export function needsServiceSummaryConfirm(intake: ServiceIntake) {
  if (!intake.issueKind) return true
  if (intake.issueKind === "return_pickup_pending") return true
  return false
}

export function isReturnPickupAwaitingThread(
  history: HistoryMessage[],
  body: string
) {
  const userTexts = history
    .filter((message) => message.role === "user")
    .slice(-6)
    .map((message) => message.content)
  userTexts.push(body)

  return userTexts.some(
    (text) =>
      classifyPostPurchaseCase(text) === "return_pickup_pending" ||
      isActiveReturnExchangePickupCase(text)
  )
}

function pickupProductPhrase(body: string) {
  if (/שטיח/i.test(body)) return "השטיח"
  if (/פוף/i.test(body)) return "הפוף"
  return "המוצר"
}

/** Awaiting courier pickup after return was already filed — summary + rep handoff, never shipping lookup. */
export function buildReturnPickupAwaitingServiceReply(
  intake: ServiceIntake,
  body: string
) {
  const product = pickupProductPhrase(body)
  const waitPhrase = intake.waitDuration
    ? ` — ${intake.waitDuration} שממתינים`
    : ""
  const summary = buildServiceHandoffSummary(intake)

  return `${CUSTOMER_HEADER}
קיבלתי 🙏 מבין שכבר פתחתם בקשת החזרה, קיבלתם את ${product}, וממתינים ששליח יאסוף אותו מהבית${waitPhrase}.

אז לסיכום לנציג השירות: ${summary}. אני צודק?`
}

/** Service cases that may still need order ID before handoff (not return-pickup-wait). */
export function buildServiceOrderIdPrompt() {
  return `${CUSTOMER_HEADER}
קיבלתי, מצטער על ההמתנה. כדי שאוכל לבדוק את הסטטוס עבורך — יש לך במקרה מספר ההזמנה?
אם לא, אני יכול לנסות לאתר לפי הטלפון שממנו אנחנו מתכתבים כעת.`
}

export function buildServiceHandoffSummary(intake: ServiceIntake) {
  const parts: string[] = []

  if (intake.issueKind) {
    parts.push(ISSUE_LABELS[intake.issueKind])
  } else {
    parts.push("פנייה לשירות")
  }

  if (intake.orderNumber) {
    parts.push(`הזמנה ${intake.orderNumber}`)
  }

  if (intake.waitDuration) {
    parts.push(`ממתינים ${intake.waitDuration}`)
  }

  if (intake.customerGoal) {
    parts.push(`מבקשים: ${intake.customerGoal}`)
  }

  return parts.join(" · ")
}

export function buildServiceHandoffConfirmReply(intake: ServiceIntake) {
  const summary = buildServiceHandoffSummary(intake)
  return `${CUSTOMER_HEADER}
אז לסיכום לנציג השירות: ${summary}. אני צודק?`
}

export function isServiceHandoffSummaryPending(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    return SERVICE_SUMMARY_PENDING_RE.test(message.content)
  }
  return false
}

export function isServiceHandoffSummaryConfirmed(body: string) {
  return /^(?:כן|נכון|בדיוק|מדויק|yes)/i.test(body.trim())
}

/** Internal note for the service rep — same facts, compact one-liner. */
export function buildServiceRepHandoffNote(intake: ServiceIntake) {
  return `[שירות] ${buildServiceHandoffSummary(intake)}`
}

export function isPostPurchaseServiceFlow(history: HistoryMessage[]) {
  return (
    isPostPurchaseIntentConfirmPending(history) ||
    isServiceHandoffSummaryPending(history) ||
    Boolean(activeIntentConfirmKind(history))
  )
}
