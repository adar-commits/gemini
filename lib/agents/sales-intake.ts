import type { AgentId, HistoryMessage } from "@/lib/agents/types"
import { salesIntakeMode } from "@/lib/agent-core/config"
import { isProductInventoryQuestion, isSpecificProductMention, extractRequestedModel } from "@/lib/agents/product-handoff"
import { isBareSkuMessage, isBranchInventoryQuestion } from "@/lib/agents/inventory-lookup"
import { isCustomerServiceOpener } from "@/lib/agents/customer-service-opener"
import {
  isFaqTopicSwitch,
  isSalesQuizAffirmation,
  isSalesTopicSwitch,
  isServiceTopicSwitch,
  isTopicPivotPhrase,
} from "@/lib/agents/topic-switch"
import { isHumanHandoffPending, isOffTopicQuestion } from "@/lib/agents/off-topic"
import { isShippingPolicyQuestion, isShippingStatusQuestion } from "@/lib/agents/shipping"
import { isDissatisfactionWithoutDefect } from "@/lib/agents/dissatisfaction"
import { isConversationClosing, isNonSubstantiveFollowUp } from "@/lib/agents/conversation-close"
import { isConfirmationAffirmationWithExtra } from "@/lib/agents/compound-reply"
import { isInactivityAssistantMessage } from "@/lib/agents/inactivity"
import { summarizeTurn, type UserTurn } from "@/lib/agents/user-turn"

export type SalesIntake = {
  product?: string
  requestedModel?: string
  targetSpace?: string
  bedroomUse?: string
  household?: string
  childrenAge?: string
  pets?: "none" | "yes"
  petsDetail?: string
  style?: string
  favoredColor?: string
  rugSize?: string
  sofaSize?: string
  furnitureSize?: string
  roomPhotoReceived?: boolean
  budget?: string
  practicalNeeds?: string
}

const CONSULTATION_RE =
  /מחפש(?:ים|ת|ים)?|רוצ(?:ה|ים|ות)\s+לקנות|אפשר\s+ל(?:קנות|רכוש|הזמין)|תקציב|עד\s+[\d,]+|כמה\s+עולה|מה\s+יש|עוזר\s+לבחור|ייעוץ|מתלבט|בין\s+שני|התאמ(?:ה|ת)|גודל\s+מתאים/i

const SPECIFIC_PRODUCT_RE =
  /דגם|sku|קזבלנקה|גארדה|collection|www\.|carpetshop\.co\.il\/products/i

const INTAKE_SHORT_ANSWER_RE =
  /^(?:סלון|חדר\s+שינה|חדר\s+ילדים|מסדרון|חלל\s+אחר|חצר|לחצר|מרפס(?:ה|ת)?|גינ(?:ה|ה)?|זוג|לזוג|משפחה|מבוגר|יש\s+(?:כלב|חתול|חיות)|אין\s+חיות|ללא\s+חיות|יוקרתי|מודרני|כפרי|\d[\d.,\s]*(?:מ(?:טר)?)?)$/i

const OUTDOOR_SPACE_RE = /חצר|מרפס(?:ה|ת)|גינ(?:ה|ה)|patio|terrace|balcony/i

const PET_ANIMAL_RE =
  /תוכי|ציפור(?:ים)?|כלב(?:ה)?|חתול(?:ה)?|ארנב|ג(?:'|׳|)ר(?:י)?ז(?:י)?|ח(?:ו(?:מ)?)?ס(?:ת)?(?:ר)?|דג(?:ים)?|אקווריום|נחש|פר(?:ט|ט)|hamster|guinea|pets?/i

const PET_CLARIFICATION_RE =
  /^(?:אבל|רק|הוא|היא|לא\s+נכנס|בסדר|בכל\s+זאת)/i

const UNKNOWN_ANSWER_RE =
  /^(?:לא\s+יודע(?:ת)?|אני\s+לא\s+יודע(?:\s+ה(?:אמת|אמת)?)?|לא\s+בטוח(?:ה)?|לא\s+מבין|אין\s+לי\s+מושג|לא\s+ממש|לא\s+כ(?:\"|״|')?כ|עזוב(?:\s+אותי)?)/i

const INTAKE_CORRECTION_RE =
  /כבר\s+שאלת|כבר\s+עניתי|עניתי\s+ש|אמרתי\s+ש|צודק/i

const FORBIDDEN_HOUSEHOLD_Q =
  /למי\s+הסלון\s+משמש|למי\s+(?:ה)?(?:סלון|חדר)\s+משמש\s+ביום/i

const INTAKE_MARKER_RE =
  /התאמת שטיח|שאלות קצרות|האם זה נכון עד כה|אני צודק|יש בעלי חיים|להתאים לבעלי חיים|מה התקציב|איזה סגנון|צבע מועדף|צבע שאהוב|מידת הספה|מידת המיטה|רהיט העיקרי|גודל כללי של הסלון|לאיזה חלל|לאן השטיח מיועד|החדר משמש ביום|דרישות מיוחדות|משהו חשוב שכדאי|לפני שנגיע למחיר|ילדים קטנים|תמונה\s+תעזור\s+ליועץ\s+לדייק|אעזור\s+לדייק\s+את\s+המידה/i

const HEBREW_COLOR_RE =
  /כחול|אדום|ירוק|צהוב|ורוד|סגול|שחור|לבן|בז(?:'|׳)?|אפור|כתום|טורקיז|חום|בורדו|זהב|כסף|נייבי|ביי(?:ז|'|׳)?/i

export { extractRequestedModel } from "@/lib/agents/product-handoff"

const PRODUCT_Q =
  "אוקיי, באיזה מוצר מדובר — שטיח, פוף, תמונת קיר, או משהו אחר?"
const SPACE_Q_RUG =
  "לאיזה חלל מיועד השטיח? סלון, חדר שינה, או כל חלל אחר"
const SPACE_Q_OTHER =
  "לאיזה חלל מיועד המוצר? סלון, חדר שינה, או כל חלל אחר"
const BEDROOM_USE_Q =
  "אוקיי קיבלתי — החדר משמש ביום־יום כחדר תינוקות, ילדים, זוגי, או משהו אחר?"
const CHILDREN_Q = "מדובר בילדים קטנים, גדולים, או גם וגם?"
const PETS_Q = "האם אמור להתאים לבעלי חיים?"
const STYLE_Q =
  "איזה סגנון או תחושה מחפשים — יוקרתי, מודרני, כפרי, או משהו אחר? יש צבע שאהוב?"
const SOFA_SIZE_Q = "מה מידת הספה?"
const SOFA_SIZE_Q_SALON = "מה מידת הספה או הגודל הכללי של הסלון?"
const FURNITURE_SIZE_Q = "מה מידת המיטה או הרהיט העיקרי בחדר?"
const SIZE_EXCHANGE_PHOTO_Q =
  "אפשר לצרף תמונה של החלל? התמונה תעזור ליועץ לדייק את המידה המתאימה."
const BUDGET_Q = "ומה התקציב המשוער?"
const PRACTICAL_Q =
  "יש משהו חשוב שכדאי לקחת בחשבון — ניקוי קל, עמידות, או משהו אחר?"

function allUserText(history: HistoryMessage[], body: string) {
  return [
    ...history.filter((message) => message.role === "user").map((message) => message.content),
    body,
  ]
    .join("\n")
    .trim()
}

function lastAssistantText(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role === "assistant") return message.content
  }
  return ""
}

function lastIntakeAssistantText(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    if (questionKindForText(message.content)) return message.content
  }
  return ""
}

export function hasUnverifiedProductRequest(text: string) {
  if (/carpetshop\.co\.il\/products|pozitiveshop\.co\.il\/products/i.test(text)) {
    return false
  }
  return extractRequestedModel(text) != null
}

export function isSpecificProductQuery(text: string) {
  if (hasUnverifiedProductRequest(text)) return false
  return SPECIFIC_PRODUCT_RE.test(text.trim())
}

export function isSalesConsultationTrigger(text: string) {
  return CONSULTATION_RE.test(text.trim())
}

const PET_MENTION_RE =
  /(?:יש\s+(?:לי\s+)?|עם\s+|בבית\s+)(?:כלב|חתול|חיה|חיות)|(?:כלב|חתול)\s+(?:ענק|קטן|גדול)/i

export function isColloquialQuizAffirmation(body: string) {
  const text = body.trim()
  if (!text || text.length > 24) return false
  return /^(?:בול|נכון|בדיוק|אכן|מדויק|אחלה|סגור|כן\s+נכון|נראה\s+לי|נראה\s+שכן)(?:[\s,.!?]*|$)/iu.test(
    text
  )
}

/** Active sales consultation — deterministic quiz or recent sales thread. */
export function isSalesQuizContext(
  history: HistoryMessage[],
  lastAgent: AgentId | null
) {
  if (hasOngoingSalesIntake(history)) return true
  if (isConfirmationPending(history)) return true
  if (lastAgent !== "sales") return false

  const recent = history.slice(-10).map((message) => message.content).join("\n")
  return /שטיח|פוף|תקציב|סגנון|סלון|חדר|בעלי חיים|חתול|כלב|התאמת|מחיר|יועץ/i.test(
    recent
  )
}

export function mentionsPetInText(text: string) {
  return PET_MENTION_RE.test(text.trim())
}

const SALES_PHOTO_REQUEST_RE =
  /(?:אפשר|רוצ(?:ה|ים|ות)?)\s+(?:ל)?(?:צר(?:ף|ור)|של(?:ח|וח))(?:\/י)?\s+תמונה|תמונה\s+של\s+(?:ה)?(?:חלל|סלון)|צר(?:ף|ור)\s+תמונה|תמונה\s+תעזור\s+ליועץ\s+לדייק\s+את\s+המידה/i

/** Customer already has the product — needs help picking the right size (exchange / resize). */
export function isSizeExchangeIntakeContext(history: HistoryMessage[], body = "") {
  const text = allUserText(history, body)
  const receivedProduct =
    /(?:קיבלתי|קיבלנו|הגיע(?:ה|ו)?|התקבל)/i.test(text) &&
    /(?:שטיח|פוף|מוצר|הזמנה)/i.test(text)
  const sizeIssue =
    /(?:גדול|קטן)\s+(?:מ(?:די|ידי)|ל(?:י|נו|הם))|לא\s+מתאים(?:\s+ל(?:י|נו))?/i.test(text) ||
    /לא\s+יודע(?:ת|ים)?(?:\s+(?:מה|איז(?:ו|ה))\s*)?(?:ה)?(?:מידה|גודל)/i.test(text) ||
    /(?:מידה|גודל)\s+(?:ש(?:אני|צריך|מתאים)|נכון|מתאים|אחר|צריך)/i.test(text) ||
    /איז(?:ו|ה)\s+מידה\s+(?:אני|צריך|מתאים)/i.test(text)
  const exchangeContext = /(?:החלפ(?:ה|ת)|להחליף|מידה\s+אחר(?:ת)?|גודל\s+אחר)/i.test(text)
  return Boolean(receivedProduct && (sizeIssue || exchangeContext))
}

function hasRoomPhotoInHistory(history: HistoryMessage[]) {
  return history.some(
    (message) => message.role === "user" && /\[media:image:/i.test(message.content)
  )
}

export function isSalesPhotoRequestPending(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    return SALES_PHOTO_REQUEST_RE.test(message.content)
  }
  return false
}

export function turnHasCustomerImage(turn: UserTurn) {
  if (turn.media.some((part) => part.kind === "image")) return true
  return /\[media:image:/i.test(summarizeTurn(turn))
}

/** Sales quiz, scripted intake, or waiting for a room photo — not order lookup. */
export function isActiveSalesConsultation(
  history: HistoryMessage[],
  lastAgent: AgentId | null
) {
  return (
    hasOngoingSalesIntake(history) ||
    isAwaitingSalesIntakeAnswer(history) ||
    isSalesQuizContext(history, lastAgent) ||
    isSalesPhotoRequestPending(history)
  )
}

/** Block order/shipment tools unless the customer clearly pivoted to post-purchase. */
export function blocksOrderLookupForSalesConsultation(
  body: string,
  history: HistoryMessage[],
  lastAgent: AgentId | null
) {
  if (isAwaitingSalesIntakeAnswer(history) && isSalesIntakeAnswer(body, history)) {
    return true
  }
  if (!isActiveSalesConsultation(history, lastAgent)) return false
  if (isIntakeTopicPivot(body, history)) return false
  if (isShippingStatusQuestion(body)) return false
  if (/(?:ה)?(?:קבלה|חשבונית)|receipt|invoice/i.test(body.trim())) return false
  return true
}

export function hasOngoingSalesIntake(history: HistoryMessage[]) {
  if (isSalesPhotoRequestPending(history)) return true
  if (isAwaitingSalesIntakeAnswer(history)) return true
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (INTAKE_MARKER_RE.test(message.content)) return true
  }
  return false
}

function intakeHasProgress(intake: SalesIntake) {
  return Boolean(
    intake.product ||
      intake.targetSpace ||
      intake.favoredColor ||
      intake.pets != null ||
      intake.style ||
      intake.budget ||
      intake.practicalNeeds
  )
}

function petsQuestionWasAsked(history: HistoryMessage[]) {
  return history.some(
    (message) => message.role === "assistant" && /בעלי חיים/.test(message.content)
  )
}

function lastIntakeQuestionKind(history: HistoryMessage[]): string | null {
  const last = lastIntakeAssistantText(history)
  if (!last) return null
  return questionKindForText(last)
}

/** Last scripted sales-quiz question waiting for a customer answer. */
export function pendingSalesIntakeQuestionKind(history: HistoryMessage[]) {
  return lastIntakeQuestionKind(history)
}

export function isAwaitingSalesIntakeAnswer(history: HistoryMessage[]) {
  return pendingSalesIntakeQuestionKind(history) != null
}

export function isLikelyBudgetIntakeAnswer(body: string) {
  const text = body.trim()
  if (!text || text.length > 40) return false
  return /^(?:עד\s+|בסביבות\s+|באזור\s+|תקציב(?:\s+של)?\s+)?[\d,]+(?:\s*(?:ש[\"״']?ח|₪|שקל(?:ים)?))?(?:[\s,.!?]|$)/i.test(
    text
  )
}

function questionKindForText(question: string): string | null {
  if (/לאיזה חלל|לאן השטיח/.test(question)) return "space"
  if (/באיזה מוצר/.test(question)) return "product"
  if (/החדר משמש|איך חדר השינה/.test(question)) return "bedroom"
  if (/ילדים קטנים/.test(question)) return "children"
  if (/בעלי חיים|להתאים לבעלי/.test(question)) return "pets"
  if (/סגנון/.test(question)) return "style"
  if (/מידת הספה|גודל כללי של הסלון/.test(question)) return "sofa"
  if (/מידת המיטה|רהיט העיקרי/.test(question)) return "furniture"
  if (/תמונה\s+של\s+החלל|תמונה\s+תעזור\s+ליועץ\s+לדייק/.test(question)) return "photo"
  if (/תקציב/.test(question)) return "budget"
  if (/דרישות מיוחדות|משהו חשוב שכדאי/.test(question)) return "practical"
  if (/האם זה נכון|אני צודק/.test(question)) return "confirm"
  return null
}

/** Consecutive user messages at the end of the thread (rapid follow-ups). */
function recentUserReplies(history: HistoryMessage[], body: string) {
  const replies = [body.trim()]
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "user") break
    replies.unshift(message.content.trim())
  }
  return replies.filter(Boolean)
}

/** Customer changed subject — leave intake and route elsewhere. */
export function isIntakeTopicPivot(body: string, history: HistoryMessage[]) {
  const trimmed = body.trim()
  if (!trimmed) return false

  // During an active quiz, only explicit FAQ/service pivots break out — not budget/style answers.
  if (hasOngoingSalesIntake(history) || lastIntakeQuestionKind(history)) {
    if (isCustomerServiceOpener(trimmed)) return true
    if (isTopicPivotPhrase(trimmed)) return true
    if (isFaqTopicSwitch(trimmed)) return true
    if (isServiceTopicSwitch(trimmed)) return true
    if (isShippingPolicyQuestion(trimmed) || isShippingStatusQuestion(trimmed)) return true
    if (isProductInventoryQuestion(trimmed) || isSpecificProductMention(trimmed)) return true
    if (isBranchInventoryQuestion(trimmed) || isBareSkuMessage(trimmed)) return true
    return false
  }

  if (isTopicPivotPhrase(trimmed)) return true
  if (isFaqTopicSwitch(trimmed)) return true
  if (isServiceTopicSwitch(trimmed)) return true
  if (isShippingPolicyQuestion(trimmed) || isShippingStatusQuestion(trimmed)) return true
  if (isProductInventoryQuestion(trimmed) || isSpecificProductMention(trimmed)) return true
  if (isBranchInventoryQuestion(trimmed) || isBareSkuMessage(trimmed)) return true
  if (
    isSalesConsultationTrigger(trimmed) &&
    trimmed.split(/\s+/).length >= 4
  ) {
    return true
  }
  if (isSalesTopicSwitch(trimmed)) return true
  return false
}

/** Answer to current quiz question vs pivot to another topic. */
export function classifySalesIntakeReply(body: string, history: HistoryMessage[]) {
  if (isIntakeTopicPivot(body, history)) return "pivot" as const
  return "answer" as const
}

/** Accept free-form quiz answers — examples in questions are hints, not an exhaustive list. */
export function isSalesIntakeAnswer(body: string, history: HistoryMessage[]) {
  const trimmed = body.trim()
  if (!trimmed || trimmed.length > 120) return false
  return classifySalesIntakeReply(body, history) === "answer"
}

export function shouldUseSalesIntakeFastPath(
  body: string,
  history: HistoryMessage[],
  lastAgent: AgentId | null
) {
  const mode = salesIntakeMode()

  if (isShippingPolicyQuestion(body) || isShippingStatusQuestion(body)) return false
  if (isFaqTopicSwitch(body)) return false
  if (isServiceTopicSwitch(body)) return false
  if (isDissatisfactionWithoutDefect(body)) return false
  if (isConversationClosing(body)) return false
  if (isNonSubstantiveFollowUp(body)) return false
  if (isOffTopicQuestion(body)) return false
  if (isHumanHandoffPending(history)) return false
  if (isProductInventoryQuestion(body) || isSpecificProductMention(body)) return false
  if (isBranchInventoryQuestion(body) || isBareSkuMessage(body)) return false
  if (hasUnverifiedProductRequest(body)) return false
  if (isSpecificProductQuery(body)) return false

  if (isSalesQuizContext(history, lastAgent)) {
    if (isIntakeTopicPivot(body, history)) return false
    return true
  }

  if (mode === "scripted") {
    if (mentionsPetInText(body)) return true
    if (hasOngoingSalesIntake(history)) {
      return classifySalesIntakeReply(body, history) === "answer"
    }
    if (isSalesConsultationTrigger(body)) return true
    return false
  }

  if (mode === "hybrid") {
    if (isSalesConsultationTrigger(body) && !hasOngoingSalesIntake(history)) return true
  }

  // llm (default) + hybrid mid-quiz: stay scripted while any intake question is open
  if (isConfirmationPending(history)) return true
  if (isAwaitingSalesIntakeAnswer(history)) {
    if (isIntakeTopicPivot(body, history)) return false
    return true
  }

  if (hasOngoingSalesIntake(history)) {
    if (isIntakeTopicPivot(body, history)) return false
    return classifySalesIntakeReply(body, history) === "answer"
  }

  return false
}

function applyPetsAnswer(intake: SalesIntake, history: HistoryMessage[], body: string) {
  const kind = lastIntakeQuestionKind(history)
  if (kind !== "pets" && intake.pets != null) return

  const replies = recentUserReplies(history, body)
  const combined = replies.join(" ")

  if (PET_ANIMAL_RE.test(combined) || /רק\s+[א-תa-z]/i.test(combined)) {
    intake.pets = "yes"
    const animal = combined.match(
      /(?:רק\s+)?(תוכי|ציפור(?:ים)?|כלב(?:ה)?|חתול(?:ה)?|[א-ת]{2,12})/i
    )?.[1]
    intake.petsDetail =
      replies.length > 1 || PET_CLARIFICATION_RE.test(body)
        ? replies.join(", ").slice(0, 80)
        : animal?.trim() || combined.slice(0, 40)
    return
  }

  if (/^(?:כן|yes)/i.test(replies[replies.length - 1] ?? "")) {
    intake.pets = "yes"
    return
  }

  const clarifiedNo =
    replies.some((reply) => hasExplicitNoPetsAnswer(reply)) ||
    (replies.length === 1 && /^(?:לא|אין|בלי|ללא)(?:[\s,.!?]|$)/i.test(replies[0]))
  if (clarifiedNo && !mentionsRealPet(combined)) {
    intake.pets = "none"
    intake.petsDetail = undefined
    return
  }

  if (PET_CLARIFICATION_RE.test(body) && replies.length >= 2) {
    intake.pets = "yes"
    intake.petsDetail = replies.join(", ").slice(0, 80)
  }
}

function applyAffirmationFromAssistantContext(
  intake: SalesIntake,
  history: HistoryMessage[],
  body: string
) {
  if (!isColloquialQuizAffirmation(body)) return

  const last = lastAssistantText(history)
  const priorUser = history
    .filter((message) => message.role === "user")
    .slice(-4)
    .map((message) => message.content)
    .join(" ")

  if (/סלון|מקום|גודל|מרפס|חדר|חלל/.test(last) && !intake.targetSpace) {
    if (/סלון/.test(last) || /סלון/.test(priorUser)) intake.targetSpace = "סלון"
    else if (/מרפס/.test(last)) intake.targetSpace = "מרפסת"
    else if (/חדר\s+שינה/.test(last)) intake.targetSpace = "חדר שינה"
    else intake.targetSpace = "סלון"
  }

  if (/ספה|מקום|גודל|מרפס|סלון|מיטה|רהיט/.test(last)) {
    if (/מיטה|רהיט/.test(last) && !intake.furnitureSize) {
      intake.furnitureSize = "לא ידוע — יועץ יבדוק"
    } else if (!intake.sofaSize && !intake.rugSize) {
      intake.sofaSize = "לא ידוע — יועץ יבדוק"
    }
  }

  if (/בעלי חיים|חתול|כלב|חיה/.test(last) && intake.pets == null) {
    if (mentionsRealPet(priorUser) || mentionsRealPet(body)) {
      intake.pets = "yes"
      const detail =
        priorUser.match(/(?:כלב(?:ה)?|חתול(?:ה)?|[א-ת]{2,12})/i)?.[0] ||
        body.match(/(?:כלב(?:ה)?|חתול(?:ה)?|[א-ת]{2,12})/i)?.[0]
      if (detail) intake.petsDetail = detail.slice(0, 40)
    }
  }
}
function applyContextualIntakeAnswers(
  intake: SalesIntake,
  history: HistoryMessage[],
  body: string,
  options?: { force?: boolean; kind?: string | null }
) {
  if (isColloquialQuizAffirmation(body) && !options?.force) {
    applyAffirmationFromAssistantContext(intake, history, body)
    applyPetsAnswer(intake, history, body)
    reconcilePetsFromThread(intake, history, body)
    return
  }

  applyAffirmationFromAssistantContext(intake, history, body)

  const kind = options?.kind ?? lastIntakeQuestionKind(history)
  if (!kind && !options?.force) return

  applyPetsAnswer(intake, history, body)

  if (kind === "style" || (options?.force && !intake.style)) {
    applyStyleAnswer(intake, recentUserReplies(history, body))
  }

  if ((kind === "bedroom" || options?.force) && !intake.bedroomUse) {
    const trimmed = body.trim()
    if (trimmed.length >= 2 && trimmed.length <= 60) {
      intake.bedroomUse = trimmed
    }
  }

  if ((kind === "children" || options?.force) && !intake.childrenAge) {
    const trimmed = body.trim()
    if (trimmed.length >= 2 && trimmed.length <= 40) {
      intake.childrenAge = trimmed
    }
  }

  if ((kind === "budget" || options?.force) && !intake.budget) {
    applyBudgetAnswer(intake, recentUserReplies(history, body))
  }

  if ((kind === "practical" || options?.force) && !intake.practicalNeeds) {
    const trimmed = body.trim()
    if (
      trimmed.length >= 2 &&
      trimmed.length <= 80 &&
      !isColloquialQuizAffirmation(trimmed)
    ) {
      intake.practicalNeeds = trimmed
    }
  }

  if ((kind === "sofa" || options?.force) && !intake.sofaSize && !intake.rugSize) {
    applySofaSizeAnswer(intake, recentUserReplies(history, body))
  }

  if ((kind === "furniture" || options?.force) && !intake.furnitureSize) {
    applyFurnitureSizeAnswer(intake, recentUserReplies(history, body))
  }
}

function normalizeSpaceAnswer(raw: string) {
  return raw.trim().replace(/^ל/, "").trim() || raw.trim()
}

function isUnknownIntakeAnswer(text: string) {
  const trimmed = text.trim()
  return UNKNOWN_ANSWER_RE.test(trimmed) || /^לא\s+מבין/i.test(trimmed)
}

function isIntakeCorrection(text: string) {
  return INTAKE_CORRECTION_RE.test(text.trim())
}

function normalizeReplyText(text: string) {
  return text.replace(/\s+/g, " ").trim()
}

/** Consecutive intake questions at the end of the thread (accidental double-reply). */
function trailingIntakeAssistantBurst(history: HistoryMessage[]) {
  const burst: HistoryMessage[] = []
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") break
    if (isInactivityAssistantMessage(message.content)) continue
    const kind = questionKindForText(message.content)
    if (!kind) {
      if (burst.length > 0) break
      break
    }
    burst.unshift(message)
  }
  return burst
}

function intakeStepSatisfied(intake: SalesIntake, kind: string) {
  switch (kind) {
    case "product":
      return Boolean(intake.product)
    case "space":
      return Boolean(intake.targetSpace)
    case "bedroom":
      return Boolean(intake.bedroomUse)
    case "children":
      return Boolean(intake.childrenAge)
    case "pets":
      return intake.pets != null
    case "style":
      return styleStepComplete(intake)
    case "sofa":
      return Boolean(intake.sofaSize || intake.rugSize)
    case "furniture":
      return Boolean(intake.furnitureSize)
    case "photo":
      return Boolean(intake.roomPhotoReceived)
    case "budget":
      return Boolean(intake.budget)
    case "practical":
      return Boolean(intake.practicalNeeds)
    default:
      return false
  }
}

function answeredEarlierInBurst(history: HistoryMessage[], intake: SalesIntake) {
  const burst = trailingIntakeAssistantBurst(history)
  if (burst.length < 2) return false
  const lastKind = questionKindForText(burst[burst.length - 1].content)
  return burst.some((message) => {
    const kind = questionKindForText(message.content)
    return Boolean(kind && kind !== lastKind && intakeStepSatisfied(intake, kind))
  })
}

function wasQuestionSentInBurst(history: HistoryMessage[], kind: string | null) {
  if (!kind) return false
  return trailingIntakeAssistantBurst(history).some(
    (message) => questionKindForText(message.content) === kind
  )
}

const SOFT_REPROMPT: Partial<Record<string, string>> = {
  product: "רק לוודא — באיזה מוצר מדובר?",
  space: "לאיזה חלל זה מיועד?",
  bedroom: "החדר משמש ביום־יום כיצד?",
  children: "מדובר בילדים קטנים, גדולים, או גם וגם?",
  pets: "לגבי בעלי חיים — האם השטיח אמור להתאים?",
  style:
    "ומה לגבי הסגנון — יוקרתי, מודרני, כפרי, או משהו אחר? ואולי גם צבע מועדף?",
  sofa: "מה מידת הספה או הגודל הכללי של הסלון?",
  furniture: "מה מידת המיטה או הרהיט העיקרי בחדר?",
  photo: "אפשר לצרף תמונה של החלל?",
  budget: "מה התקציב המשוער?",
  practical: "יש דרישות מיוחדות — למשל קל לניקוי/כביסה או עמיד?",
}

function formatIntakeQuestionReply(
  history: HistoryMessage[],
  question: string,
  kind: string | null
) {
  if (wasQuestionSentInBurst(history, kind) && kind) {
    return SOFT_REPROMPT[kind] ?? question
  }
  const normalizedQuestion = normalizeReplyText(question)
  const last = normalizeReplyText(lastIntakeAssistantText(history))
  if (normalizedQuestion === last && kind) {
    return SOFT_REPROMPT[kind] ?? question
  }
  return question
}

type IntakePair = { kind: string; answers: string[] }

/** Map intake Q→A pairs; one user reply answers the first unanswered question in a burst. */
function parseIntakeQAPairs(messages: HistoryMessage[]): IntakePair[] {
  const pairs: IntakePair[] = []
  let index = 0

  while (index < messages.length) {
    const message = messages[index]
    if (message.role !== "assistant") {
      index += 1
      continue
    }

    if (isInactivityAssistantMessage(message.content)) {
      index += 1
      continue
    }

    const firstKind = questionKindForText(message.content)
    if (!firstKind) {
      index += 1
      continue
    }

    const burstKinds: string[] = [firstKind]
    let scan = index + 1
    while (scan < messages.length && messages[scan].role === "assistant") {
      if (isInactivityAssistantMessage(messages[scan].content)) {
        scan += 1
        continue
      }
      const kind = questionKindForText(messages[scan].content)
      if (!kind) break
      burstKinds.push(kind)
      scan += 1
    }

    const answers: string[] = []
    while (scan < messages.length && messages[scan].role === "user") {
      answers.push(messages[scan].content.trim())
      scan += 1
    }

    if (burstKinds.length === 1 && answers.length > 0) {
      pairs.push({ kind: burstKinds[0], answers })
    } else {
      for (let burstIndex = 0; burstIndex < burstKinds.length; burstIndex += 1) {
        pairs.push({
          kind: burstKinds[burstIndex],
          answers: answers[burstIndex] ? [answers[burstIndex]] : [],
        })
      }
    }

    index = scan
  }

  return pairs
}

function applyProductAnswer(intake: SalesIntake, combined: string) {
  if (/שטיח/.test(combined)) intake.product = "שטיח"
  else if (/פוף|bean\s*bag/i.test(combined)) intake.product = "פוף"
  else if (/תמונ(?:ה|ת)|wall[\s-]?art/i.test(combined)) intake.product = "תמונת קיר"
  else if (/אביזר|accessories?/i.test(combined)) intake.product = "אביזר לעיצוב"
  else if (/כרית/.test(combined)) intake.product = "כרית"
}

function applySpaceAnswer(intake: SalesIntake, answers: string[]) {
  const combined = answers.join(" ")
  if (!combined || isUnknownIntakeAnswer(combined)) return

  if (/חדר\s+ילדים/.test(combined)) intake.targetSpace = "חדר ילדים"
  else if (/חדר\s+שינה/.test(combined)) intake.targetSpace = "חדר שינה"
  else if (/סלון/.test(combined)) intake.targetSpace = "סלון"
  else if (/מסדרון/.test(combined)) intake.targetSpace = "מסדרון"
  else if (OUTDOOR_SPACE_RE.test(combined)) {
    const outdoor = combined.match(
      /(?:ל)?(חצר(?:\s+\S+)?|מרפס(?:ה|ת)(?:\s+\S+)?|גינ(?:ה|ה)(?:\s+\S+)?)/i
    )?.[1]
    intake.targetSpace = normalizeSpaceAnswer(outdoor || answers[0])
  } else if (/מחסן/.test(combined)) {
    const warehouse = combined.match(/(?:ל)?(מחסן(?:\s+\S+){0,3})/i)?.[1]
    intake.targetSpace = normalizeSpaceAnswer(warehouse || answers[0])
  } else {
    intake.targetSpace = normalizeSpaceAnswer(answers[0])
  }
}

function petsDontEnterSpace(combined: string) {
  return /לא\s+(?:מפריע|נכנס|עולה|יורד)|בחוץ|לא\s+נכנס(?:ים)?\s+ל(?:ח|חל)/i.test(combined)
}

function hasExplicitNoPetsAnswer(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return false

  return (
    /אין\s+(?:לנו\s+)?חיות(?:\s+בבית)?/i.test(trimmed) ||
    /(?:^|[\s,.])(?:לא|בלי|ללא)[\s,]*(?:לנו\s+)?(?:יש\s+)?חיות/i.test(trimmed) ||
    /(?:^|[\s,.])לא[\s,]+(?:אין|בלי|ללא)\s+(?:לנו\s+)?חיות/i.test(trimmed) ||
    /^(?:לא|אין|בלי|ללא)(?:[\s,.!?]|$)/i.test(trimmed.split(/[.!?]/)[0]?.trim() ?? "")
  )
}

function mentionsRealPet(combined: string) {
  if (PET_ANIMAL_RE.test(combined)) return true
  return /רק\s+(?:כלב|חתול|תוכי|ציפור|[א-ת]{2,12})/i.test(combined)
}

function extractQualitativeSize(text: string): string | null {
  const match =
    text.match(/(?:ב)?גודל(?:\s+(?:ה)?(?:סלון|חדר))?\s*(קטן|בינוני|גדול)/i) ||
    text.match(/(?:סלון|חדר)\s+(?:ב)?(קטן|בינוני|גדול)/i) ||
    text.match(/\b(קטן|בינוני|גדול)\b/i)
  return match?.[1] ?? null
}

function extractHebrewMeterSize(text: string): string | null {
  const match = text.match(
    /(?:כ|ב)?(?:ערך\s+)?(שניים?|שלוש(?:ה)?|ארבע(?:ה)?|חמיש(?:ה)?|\d(?:[.,]\d+)?)\s*מ(?:טר|׳|')?/i
  )
  if (!match) return null
  const raw = match[1].replace(",", ".")
  const words: Record<string, string> = {
    שניים: "2",
    שני: "2",
    שלוש: "3",
    שלושה: "3",
    ארבע: "4",
    ארבעה: "4",
    חמישה: "5",
  }
  const normalized = words[raw.toLowerCase()] ?? raw
  return `${normalized} מטר`
}

function isLivingRoomSpace(targetSpace?: string) {
  return Boolean(targetSpace && (targetSpace === "סלון" || /^סלון/i.test(targetSpace)))
}

function sofaSizeQuestion(intake: SalesIntake) {
  if (isLivingRoomSpace(intake.targetSpace)) return SOFA_SIZE_Q_SALON
  return SOFA_SIZE_Q
}

function applyStyleAnswer(intake: SalesIntake, answers: string[]) {
  const combined = answers.join(" ")
  if (!combined) return
  if (isColloquialQuizAffirmation(combined)) return
  if (isUnknownIntakeAnswer(combined)) {
    intake.style = "ללא העדפת סגנון"
    return
  }

  const color = extractFavoredColor(combined)
  if (color) intake.favoredColor = color

  if (/יוקרתי/.test(combined)) intake.style = "יוקרתי"
  else if (/מודרני/.test(combined)) intake.style = "מודרני"
  else if (/כפרי/.test(combined)) intake.style = "כפרי"
  else if (/ייחוד|ooak|one[\s-]?of[\s-]?a[\s-]?kind|משהו\s+מיוחד/i.test(combined)) {
    intake.style = "ייחודי"
  } else if (color && !intake.style) {
    intake.style = "ללא העדפת סגנון"
  } else if (!intake.style && combined.length <= 50) {
    intake.style = combined.slice(0, 50)
  }
}

function applySofaSizeAnswer(intake: SalesIntake, answers: string[]) {
  const combined = answers.join(" ")
  if (!combined || isColloquialQuizAffirmation(combined)) return

  const slashMatch = combined.match(/\b(\d{2,4})\s*[\/x×]\s*(\d{2,4})\b/)
  if (slashMatch) {
    intake.rugSize = `${slashMatch[1]}/${slashMatch[2]}`
    return
  }

  const hebrewMeters = extractHebrewMeterSize(combined)
  if (hebrewMeters) {
    intake.sofaSize = hebrewMeters
  }

  const numericMatch = combined.match(/(\d\s*[-–]\s*\d|\d(?:\.\d)?)\s*מ(?:טר)?/)
  if (numericMatch) {
    intake.sofaSize = numericMatch[1].replace(/\s/g, "")
    return
  }

  const qualitative = extractQualitativeSize(combined)
  if (qualitative) {
    intake.rugSize = qualitative
  }

  if (isUnknownIntakeAnswer(combined) || /לא\s+יודע/i.test(combined)) {
    intake.sofaSize = "לא ידוע — יועץ יבדוק"
    return
  }

  if (!intake.sofaSize && /ספה|שזלונג|מטר|סלון|בינוני|גדול|קטן/.test(combined)) {
    intake.sofaSize = combined.slice(0, 80)
    return
  }

  if (!intake.sofaSize && combined.length <= 30) {
    intake.sofaSize = combined
  }
}

function applyFurnitureSizeAnswer(intake: SalesIntake, answers: string[]) {
  const combined = answers.join(" ")
  if (!combined || isColloquialQuizAffirmation(combined)) return

  if (isUnknownIntakeAnswer(combined) || /לא\s+יודע/i.test(combined)) {
    intake.furnitureSize = "לא ידוע — יועץ יבדוק"
    return
  }

  const slashMatch = combined.match(/\b(\d{2,4})\s*[\/x×]\s*(\d{2,4})\b/)
  if (slashMatch) {
    intake.furnitureSize = `${slashMatch[1]}/${slashMatch[2]}`
    return
  }

  const hebrewMeters = extractHebrewMeterSize(combined)
  if (hebrewMeters) {
    intake.furnitureSize = hebrewMeters
    return
  }

  const numericMatch = combined.match(/(\d\s*[-–]\s*\d|\d(?:\.\d)?)\s*מ(?:טר)?/)
  if (numericMatch) {
    intake.furnitureSize = numericMatch[1].replace(/\s/g, "")
    return
  }

  if (/זוגית|יחיד|מיטה|160|180|200|140|120|90|מטר|גדול|קטן|בינוני/.test(combined)) {
    intake.furnitureSize = combined.slice(0, 80)
    return
  }

  if (combined.length <= 40) {
    intake.furnitureSize = combined
  }
}

function extractFavoredColor(text: string): string | null {
  const named = text.match(HEBREW_COLOR_RE)?.[0]
  if (named) return named
  const match = text.match(/צבע(?:\s+מועדף)?\s*(?:של)?\s*([א-ת]{2,15})/i)
  return match?.[1]?.trim() ?? null
}

function isChildrenRoomSpace(targetSpace?: string) {
  return Boolean(targetSpace && /חדר\s+ילדים|ילדים|נוער|תינוקות/i.test(targetSpace))
}

/** Style is implied for children's rooms — skip asking. */
function ensureImplicitStyle(intake: SalesIntake) {
  if (!intake.style && isChildrenRoomSpace(intake.targetSpace)) {
    intake.style = "מתאים לחדר ילדים"
  }
}

function styleStepComplete(intake: SalesIntake) {
  ensureImplicitStyle(intake)
  return Boolean(intake.style)
}

function applyBudgetAnswer(intake: SalesIntake, answers: string[]) {
  const combined = answers.join(" ")
  if (!combined) return

  const match =
    combined.match(/(?:תקציב|באזור|עד|בסביבות)\s*([\d,]+)/i) ||
    combined.match(/([\d,]+)\s*(?:ש[\"״']?ח|₪|שקל)/i) ||
    combined.match(/(\d[\d,]+)/)

  if (match) {
    intake.budget = match[1].replace(/,/g, "")
    return
  }

  if (!isUnknownIntakeAnswer(combined)) {
    intake.budget = answers[answers.length - 1].replace(/[^\d]/g, "") || undefined
  }
}

function applyPetsAnswerFromText(intake: SalesIntake, answers: string[]) {
  const combined = answers.join(" ")
  if (!combined) return

  const firstAnswer = answers[0] ?? ""
  if (
    (hasExplicitNoPetsAnswer(firstAnswer) || hasExplicitNoPetsAnswer(combined)) &&
    !mentionsRealPet(combined)
  ) {
    intake.pets = "none"
    intake.petsDetail = undefined
    return
  }

  if (petsDontEnterSpace(combined)) {
    intake.pets = "none"
    intake.petsDetail = undefined
    return
  }

  if (PET_ANIMAL_RE.test(combined) || /רק\s+[א-תa-z]/i.test(combined)) {
    intake.pets = "yes"
    intake.petsDetail = answers.join(", ").slice(0, 80)
    return
  }

  if (/^(?:כן|yes)/i.test(answers[answers.length - 1] ?? "")) {
    intake.pets = "yes"
    return
  }

  if (/^(?:לא|אין|בלי|ללא)\s+חיות|ללא\s+חיות|אין\s+(?:לנו\s+)?חיות|בלי\s+חיות/i.test(combined)) {
    intake.pets = "none"
    return
  }

  // Lone "לא" may be followed by "רק תוכי" — defer; reconcilePetsFromThread resolves.
  if (answers.length === 1 && /^(?:לא)(?:[\s,.!?]|$)/i.test(answers[0])) {
    return
  }

  if (PET_CLARIFICATION_RE.test(answers[answers.length - 1] ?? "") && answers.length >= 2) {
    intake.pets = "yes"
    intake.petsDetail = answers.join(", ").slice(0, 80)
  }
}

/** After pets Q, scan full thread — "לא" then "רק תוכי" must not stick as no pets. */
function reconcilePetsFromThread(
  intake: SalesIntake,
  history: HistoryMessage[],
  body: string
) {
  if (!petsQuestionWasAsked(history)) return

  const messages: HistoryMessage[] = [...history, { role: "user", content: body }]
  const petAnswers: string[] = []
  let collecting = false

  for (const message of messages) {
    if (message.role === "assistant" && /בעלי חיים/.test(message.content)) {
      collecting = true
      petAnswers.length = 0
      continue
    }
    if (collecting && message.role === "user") {
      petAnswers.push(message.content.trim())
    }
    if (collecting && message.role === "assistant" && !/בעלי חיים/.test(message.content)) {
      collecting = false
    }
  }

  const combined = petAnswers.join(" ")
  if (!combined) return

  if (
    (hasExplicitNoPetsAnswer(petAnswers[0] ?? "") || hasExplicitNoPetsAnswer(combined)) &&
    !mentionsRealPet(combined)
  ) {
    intake.pets = "none"
    intake.petsDetail = undefined
    return
  }

  if (petsDontEnterSpace(combined)) {
    intake.pets = "none"
    intake.petsDetail = undefined
    return
  }

  if (PET_ANIMAL_RE.test(combined) || /רק\s+[א-תa-z]/i.test(combined)) {
    intake.pets = "yes"
    intake.petsDetail = petAnswers.join(", ").slice(0, 80)
    return
  }

  if (/^(?:לא|אין|בלי|ללא)(?:[\s,.!?]|$)/i.test(petAnswers[0]) && !mentionsRealPet(combined)) {
    intake.pets = "none"
  }
}

/** Walk Q→A pairs in thread so answers persist across later turns. */
function walkIntakeFromHistory(history: HistoryMessage[], body: string): SalesIntake {
  const intake: SalesIntake = {}
  const messages: HistoryMessage[] = [...history, { role: "user", content: body }]

  for (const pair of parseIntakeQAPairs(messages)) {
    if (pair.answers.length === 0) continue

    const answers = pair.answers
    const combined = answers.join(" ")

    switch (pair.kind) {
      case "product":
        applyProductAnswer(intake, combined)
        break
      case "space":
        applySpaceAnswer(intake, answers)
        break
      case "bedroom":
        if (!isUnknownIntakeAnswer(combined)) {
          intake.bedroomUse = answers[answers.length - 1].slice(0, 60)
        }
        break
      case "children":
        if (!isUnknownIntakeAnswer(combined)) {
          intake.childrenAge = answers[answers.length - 1].slice(0, 40)
        }
        break
      case "pets":
        applyPetsAnswerFromText(intake, answers)
        break
      case "style":
        applyStyleAnswer(intake, answers)
        break
      case "sofa":
        applySofaSizeAnswer(intake, answers)
        break
      case "furniture":
        applyFurnitureSizeAnswer(intake, answers)
        break
      case "budget":
        applyBudgetAnswer(intake, answers)
        break
      case "practical":
        if (isUnknownIntakeAnswer(combined)) {
          intake.practicalNeeds = "לא בטוח — יועץ יבדוק"
        } else if (!isColloquialQuizAffirmation(combined)) {
          intake.practicalNeeds = answers[answers.length - 1].slice(0, 80)
        }
        break
      default:
        break
    }
  }

  // Customer correcting us — re-extract space from complaint text.
  if (isIntakeCorrection(body) && /מחסן|חצר|מרפס|סלון|חדר|מסדרון/i.test(body)) {
    applySpaceAnswer(intake, [body])
  }

  return intake
}

function wasSpaceQuestionAsked(history: HistoryMessage[]) {
  const last = lastAssistantText(history)
  return /לאיזה חלל|לאן השטיח|מקום פנוי|גודל.*סלון|לאיזה\s+חלל/.test(last)
}

export function extractSalesIntake(history: HistoryMessage[], body: string): SalesIntake {
  const intake = walkIntakeFromHistory(history, body)
  const text = allUserText(history, body)

  if (!intake.product) {
    if (/שטיח/.test(text)) intake.product = "שטיח"
    else if (/פוף|bean\s*bag/i.test(text)) intake.product = "פוף"
    else if (/תמונ(?:ה|ת)|wall[\s-]?art/i.test(text)) intake.product = "תמונת קיר"
    else if (/אביזר|accessories?/i.test(text)) intake.product = "אביזר לעיצוב"
    else if (/כרית/.test(text)) intake.product = "כרית"
  }

  const requestedModel =
    extractRequestedModel(body) ||
    extractRequestedModel(text) ||
    undefined
  if (requestedModel) intake.requestedModel = requestedModel

  if (!intake.bedroomUse) {
    if (/חדר\s+תינוקות|תינוק/.test(text)) intake.bedroomUse = "חדר תינוקות"
    else if (/חדר\s+(?:ילדים|נוער)/.test(text)) {
      intake.bedroomUse = "חדר ילדים או נוער"
    } else if (/חדר\s+זוגי|לזוג/.test(text)) intake.bedroomUse = "חדר זוגי"
    else if (/חדר\s+ליחיד|ליחיד/.test(text)) intake.bedroomUse = "חדר ליחיד"
    else if (/מבוגר/.test(text) && /חדר\s+שינה|שינה/.test(text)) {
      intake.bedroomUse = "חדר לאדם מבוגר"
    }
  }

  if (!intake.budget) {
    const budgetMatch =
      text.match(/(?:תקציב|באזור|עד|בסביבות)\s*([\d,]+)/i) ||
      text.match(/עד\s+([\d,]+)\s*(?:ש[\"״']?ח|₪|שקל)/i) ||
      text.match(/(\d{2,4})\s*שקל/i) ||
      text.match(/תקציב(?:\s+של)?\s+([\d,]+)/i)
    if (budgetMatch) intake.budget = budgetMatch[1].replace(/,/g, "")
  }

  if (!intake.household) {
    if (/משפחה\s+עם\s+ילדים|ילדים\s+קטנים|יש\s+ילדים|עם\s+ילדים/.test(text)) {
      intake.household = "משפחה עם ילדים"
    } else if (/לזוג|זוג(\s|$)/.test(text)) {
      intake.household = "זוג"
    } else if (/מבוגר/.test(text)) {
      intake.household = "אדם מבוגר"
    }
  }

  if (!intake.childrenAge) {
    const childrenAgeMatch = text.match(/גיל(?:אי)?\s*([\d]+(?:\s*[-–]\s*[\d]+)?)/)
    if (childrenAgeMatch) intake.childrenAge = childrenAgeMatch[1].replace(/\s/g, "")
    else if (/ילדים\s+קטנים/.test(text)) intake.childrenAge = "קטנים"
    else if (/ילדים\s+גדולים/.test(text)) intake.childrenAge = "גדולים"
  }

  if (intake.pets == null) {
    if (hasExplicitNoPetsAnswer(text) || /ללא\s+חיות|בלי\s+חיות/i.test(text)) {
      intake.pets = "none"
    } else if (
      mentionsRealPet(text) ||
      /יש\s+(?:כלב|חתול)|עם\s+(?:כלב|חתול)|כלב|חתול|תוכי|אקווריום|דגים/.test(text)
    ) {
      intake.pets = "yes"
    }
  }

  reconcilePetsFromThread(intake, history, body)

  if (!intake.rugSize) {
    const slashSizeMatch = body.trim().match(/\b(\d{2,4})\s*[\/x×]\s*(\d{2,4})\b/)
    if (slashSizeMatch) {
      intake.rugSize = `${slashSizeMatch[1]}/${slashSizeMatch[2]}`
    }
    const rugSizeMatch = text.match(/(\d\s*[-–]\s*\d|\d(?:\.\d)?)\s*מ(?:טר)?/)
    if (!intake.rugSize && rugSizeMatch) {
      intake.rugSize = `${rugSizeMatch[1].replace(/\s/g, "")} מטר`
    }
  }

  if (!intake.sofaSize) {
    const sofaMatch = text.match(/ספה\s+(?:של\s+)?(\d\s*[-–]\s*\d|\d(?:\.\d)?)\s*מ(?:טר)?/)
    if (sofaMatch) intake.sofaSize = sofaMatch[1].replace(/\s/g, "")
  }

  if (!intake.practicalNeeds && /כבס|ניקוי|עמיד|קל\s+לניקוי/.test(text)) {
    intake.practicalNeeds = "ניתן לכבס / קל לניקוי"
  }

  if (!intake.favoredColor) {
    const color = extractFavoredColor(text)
    if (color) intake.favoredColor = color
  }

  if (!intake.style && intake.favoredColor) {
    intake.style = "לפי צבע מועדף"
  }

  applyContextualIntakeAnswers(intake, history, body)

  if (
    !intake.targetSpace &&
    /(?:סלון|חדר\s+(?:ילדים|שינה|נוער)|מסדרון|מרפס|חצר|גינ(?:ה|ה)|מחסן)/i.test(text)
  ) {
    applySpaceAnswer(intake, [text])
  }

  if (!intake.targetSpace && wasSpaceQuestionAsked(history)) {
    const trimmed = body.trim()
    if (
      trimmed.length >= 2 &&
      trimmed.length <= 50 &&
      !isUnknownIntakeAnswer(trimmed) &&
      (!/^(?:כן|לא)(?:[\s,.!?]|$)/i.test(trimmed) || isColloquialQuizAffirmation(trimmed))
    ) {
      if (isColloquialQuizAffirmation(trimmed)) {
        applyAffirmationFromAssistantContext(intake, history, body)
      } else {
        applySpaceAnswer(intake, [trimmed])
      }
    }
  }

  ensureImplicitStyle(intake)

  if (hasRoomPhotoInHistory(history) || /\[media:image:/i.test(body)) {
    intake.roomPhotoReceived = true
  }

  return intake
}

function needsPracticalNeeds(intake: SalesIntake) {
  return (
    intake.household?.includes("ילד") ||
    intake.childrenAge != null ||
    intake.pets === "yes"
  )
}

function spaceQuestion(intake: SalesIntake) {
  if (intake.product === "שטיח" || !intake.product) return SPACE_Q_RUG
  return SPACE_Q_OTHER
}

function needsFurnitureSizeQuestion(intake: SalesIntake) {
  if (!intake.targetSpace) return false
  return !isLivingRoomSpace(intake.targetSpace)
}

function nextSizeExchangeIntakeQuestion(intake: SalesIntake, history: HistoryMessage[]) {
  if (!intake.product) return PRODUCT_Q
  if (!intake.targetSpace) return spaceQuestion(intake)
  if (
    isLivingRoomSpace(intake.targetSpace) &&
    intake.product === "שטיח" &&
    !intake.rugSize &&
    !intake.sofaSize
  ) {
    return sofaSizeQuestion(intake)
  }
  if (needsFurnitureSizeQuestion(intake) && !intake.furnitureSize) {
    return FURNITURE_SIZE_Q
  }
  if (!intake.roomPhotoReceived && !hasRoomPhotoInHistory(history)) {
    return SIZE_EXCHANGE_PHOTO_Q
  }
  return null
}

function nextIntakeQuestion(
  intake: SalesIntake,
  history: HistoryMessage[] = [],
  body = ""
): string | null {
  if (isSizeExchangeIntakeContext(history, body)) {
    return nextSizeExchangeIntakeQuestion(intake, history)
  }
  if (!intake.product) return PRODUCT_Q
  if (!intake.targetSpace) return spaceQuestion(intake)
  if (intake.targetSpace === "חדר שינה" && !intake.bedroomUse) return BEDROOM_USE_Q
  if (intake.household?.includes("ילד") && !intake.childrenAge) return CHILDREN_Q
  if (intake.pets == null && intake.product === "שטיח") return PETS_Q
  if (!styleStepComplete(intake)) return STYLE_Q
  if (isLivingRoomSpace(intake.targetSpace) && intake.product === "שטיח" && !intake.rugSize && !intake.sofaSize) {
    return sofaSizeQuestion(intake)
  }
  if (!intake.budget) return BUDGET_Q
  if (needsPracticalNeeds(intake) && !intake.practicalNeeds) return PRACTICAL_Q
  return null
}

function isPriceFirstFlow(text: string) {
  return /תקציב|עד\s+[\d,]+|כמה\s+עולה|מה\s+יש\s+ב/.test(text)
}

const VISUAL_CONSULT_RE =
  /ת(?:מונה|מונ(?:ה|ות))|צ(?:לם|למ(?:י|ו)|ילום)|בין\s+שני\s+שטיח|ה(?:שוו|שווה)\s+בין|ת(?:ייעצ|ייעצ)|י(?:ועץ|יעוץ)\s+(?:בין|ל)?(?:בחיר|השווא)/i

export function isVisualConsultationRequest(text: string) {
  return VISUAL_CONSULT_RE.test(text.trim())
}

function visualConsultAck(body: string) {
  if (!isVisualConsultationRequest(body)) return ""
  return "בשמחה — אפשר לשלוח תמונה של החלל ונעביר ליועץ שיעזור להשוות בין האפשרויות.\n"
}

function introForFlow(text: string, history: HistoryMessage[], intake: SalesIntake) {
  const visualAck = visualConsultAck(text)
  if (visualAck) return visualAck
  if (isSizeExchangeIntakeContext(history, text) && !hasOngoingSalesIntake(history)) {
    return "בסדר, אעזור לדייק את המידה.\n"
  }
  if (hasOngoingSalesIntake(history)) return ""
  if (intakeHasProgress(intake)) return ""
  if (
    (intake.requestedModel || hasUnverifiedProductRequest(text)) &&
    !isSalesConsultationTrigger(text)
  ) {
    return ""
  }
  if (isPriceFirstFlow(text) && !hasOngoingSalesIntake(history)) {
    return "לפני שנגיע למחיר, אשמח לשאול כמה שאלות קצרות של התאמת שטיח."
  }
  return `בשמחה,
שטיח נכון הוא הבמה של החלל – מחבר ברכות בין הרהיטים, עוטף את המרחב ומוסיף חמימות ✨
אשאל כמה שאלות קצרות כדי שיועץ העיצוב יוכל לדייק את ההתאמה 😊`
}

function formatBudget(budget: string) {
  const numeric = Number(budget.replace(/,/g, ""))
  if (Number.isFinite(numeric)) return numeric.toLocaleString("he-IL")
  return budget
}

export function buildPostConfirmationReply(body: string, history: HistoryMessage[]) {
  const trimmed = body.trim()
  if (/^(?:כן|נכון|בדיוק|מדויק|yes)/i.test(trimmed)) {
    if (isConfirmationAffirmationWithExtra(trimmed)) {
      return buildConfirmationSummary(extractSalesIntake(history, body))
    }
    return "מעולה. האם להעביר את הפנייה כעת ליועץ מכירות ועיצוב אנושי?"
  }
  return buildConfirmationSummary(extractSalesIntake(history, body))
}

export function buildConfirmationSummary(intake: SalesIntake) {
  const product = intake.product ?? "שטיח"
  const space = intake.targetSpace ? ` ל${intake.targetSpace}` : ""
  const sizeLabel = formatSizeForSummary(intake)
  const stylePhrase = formatStyleForSummary(intake)
  const petsPhrase = formatPetsForSummary(intake)
  const colorPhrase = formatColorForSummary(intake)
  const budgetPhrase = intake.budget
    ? `עד תקציב של ${formatBudget(intake.budget)} ש״ח`
    : ""
  const practicalPhrase =
    intake.practicalNeeds && !/לא\s+בטוח|לא\s+יודע/i.test(intake.practicalNeeds)
      ? intake.practicalNeeds
      : ""
  const modelPhrase = intake.requestedModel
    ? `עם עניין בדגם "${intake.requestedModel}" (לבדיקה ע"י יועץ)`
    : ""

  let summary = `אנחנו מחפשים לך ${product}${space}`
  if (sizeLabel) summary += ` בגודל ${sizeLabel}`

  const tail: string[] = []
  if (stylePhrase) tail.push(stylePhrase)
  if (petsPhrase) tail.push(petsPhrase)
  if (colorPhrase) tail.push(colorPhrase)
  if (budgetPhrase) tail.push(budgetPhrase)
  if (practicalPhrase) tail.push(`חשוב: ${practicalPhrase}`)
  if (modelPhrase) tail.push(modelPhrase)

  if (tail.length > 0) {
    summary += ` ${tail.join(", ")}`
  }

  return `אוקיי, אז לסיכום ${summary}. אני צודק?`
}

export function buildSizeExchangeConfirmationSummary(intake: SalesIntake) {
  const product = intake.product ?? "שטיח"
  const space = intake.targetSpace ? ` ל${intake.targetSpace}` : ""
  const sizeLabel =
    formatSizeForSummary(intake) ||
    (intake.furnitureSize && intake.furnitureSize.length <= 40 ? intake.furnitureSize : null)
  let summary = `צריך ${product}${space}`
  if (sizeLabel) summary += ` — מידה משוערת: ${sizeLabel}`
  if (intake.roomPhotoReceived) summary += ", עם תמונת חלל"
  return `אוקיי, אז לסיכום ${summary}. אני צודק?`
}

function formatSizeForSummary(intake: SalesIntake) {
  if (intake.rugSize && /^(?:קטן|בינוני|גדול)$/i.test(intake.rugSize)) {
    return intake.rugSize
  }
  if (intake.rugSize) return intake.rugSize.replace(/\s+מטר$/, " מטר")
  if (intake.sofaSize && /^\d/.test(intake.sofaSize)) {
    return `ספה ${intake.sofaSize} מטר`
  }
  if (intake.sofaSize && intake.sofaSize.length <= 20) return intake.sofaSize
  if (intake.furnitureSize && intake.furnitureSize.length <= 30) return intake.furnitureSize
  return null
}

function formatStyleForSummary(intake: SalesIntake) {
  const style = intake.style?.trim()
  if (style === "ייחודי" && intake.favoredColor) return null
  if (!style || /לא\s+בטוח|לא\s+יודע/i.test(style)) return "ללא העדפת סגנון"
  if (style === "ללא העדפת סגנון") return style
  if (style === "ייחודי") return "בסגנון ייחודי"
  if (/יוקרתי|מודרני|כפרי/.test(style)) return `בסגנון ${style}`
  if (intake.favoredColor && style.includes(intake.favoredColor)) return "ללא העדפת סגנון"
  if (style.length > 35) return "ללא העדפת סגנון"
  return `בסגנון ${style}`
}

function formatPetsForSummary(intake: SalesIntake) {
  if (intake.pets === "none") return "ללא בעלי חיים"
  if (intake.pets === "yes") {
    if (intake.petsDetail && petsDontEnterSpace(intake.petsDetail)) return "ללא בעלי חיים"
    if (intake.petsDetail && intake.petsDetail.length <= 25) {
      return `עם ${intake.petsDetail}`
    }
    return "עם בעלי חיים"
  }
  return null
}

function formatColorForSummary(intake: SalesIntake) {
  if (!intake.favoredColor) return null
  if (intake.style === "ייחודי") {
    return `צבע מועדף ${intake.favoredColor}, משהו ייחודי`
  }
  return `צבע מועדף ${intake.favoredColor}`
}

export function isConfirmationPending(history: HistoryMessage[]) {
  return /האם זה נכון עד כה|אני צודק/.test(lastIntakeAssistantText(history))
}

export function sanitizeSalesReply(reply: string, history: HistoryMessage[], body: string) {
  if (!FORBIDDEN_HOUSEHOLD_Q.test(reply)) return reply
  return buildSalesIntakeReply(history, body)
}

function openingAckPrefix(history: HistoryMessage[], intake: SalesIntake) {
  if (hasOngoingSalesIntake(history)) return ""
  if (!intakeHasProgress(intake)) return ""
  return "אוקיי הבנתי, "
}

export function buildSalesIntakeReply(history: HistoryMessage[], body: string) {
  const intake = extractSalesIntake(history, body)
  const pendingKind = lastIntakeQuestionKind(history)
  if (pendingKind && body.trim() && !intakeStepSatisfied(intake, pendingKind)) {
    applyContextualIntakeAnswers(intake, history, body, {
      force: true,
      kind: pendingKind,
    })
    if (pendingKind === "pets") {
      reconcilePetsFromThread(intake, history, body)
    }
  }

  const intro = introForFlow(body, history, intake)
  const recoveringFromDoubleReply = trailingIntakeAssistantBurst(history).length >= 2
  const doubleReplyJustHandled =
    recoveringFromDoubleReply && answeredEarlierInBurst(history, intake)

  let next = nextIntakeQuestion(intake, history, body)
  const lastKind = lastIntakeQuestionKind(history)
  const nextKind = next ? questionKindForText(next) : null
  const sizeExchange = isSizeExchangeIntakeContext(history, body)

  // Never repeat the same question — accept the reply and advance.
  if (next && lastKind && nextKind === lastKind && !doubleReplyJustHandled) {
    if (!intakeStepSatisfied(intake, lastKind)) {
      applyContextualIntakeAnswers(intake, history, body, {
        force: true,
        kind: lastKind,
      })
      if (lastKind === "pets") {
        reconcilePetsFromThread(intake, history, body)
      }
    }
    next = nextIntakeQuestion(intake, history, body)
  }

  // Never go backwards (e.g. re-ask pets after budget was already asked).
  if (
    next &&
    lastKind &&
    nextKind &&
    !sizeExchange &&
    questionOrder(nextKind) < questionOrder(lastKind)
  ) {
    applyContextualIntakeAnswers(intake, history, body, { force: true })
    reconcilePetsFromThread(intake, history, body)
    next = nextIntakeQuestion(intake, history, body)
    if (next && nextKind && questionOrder(questionKindForText(next) ?? "") < questionOrder(lastKind)) {
      next = null
    }
  }

  const correctionPrefix = isIntakeCorrection(body) ? "צודק/ת, תודה על הסבלנות.\n" : ""
  const recoveryPrefix =
    doubleReplyJustHandled && !isIntakeCorrection(body) ? "אוקיי, קיבלתי.\n" : ""
  const answerAckPrefix =
    !recoveryPrefix && !correctionPrefix && lastKind && next && !next.startsWith("אוקיי")
      ? intakeAnswerAcknowledgment(lastKind, body)
      : ""

  if (!next) {
    const summary = sizeExchange
      ? buildSizeExchangeConfirmationSummary(intake)
      : buildConfirmationSummary(intake)
    return correctionPrefix + recoveryPrefix + summary
  }

  const question = formatIntakeQuestionReply(history, next, nextKind)
  const openingPrefix = !intro && !answerAckPrefix ? openingAckPrefix(history, intake) : ""
  const reply = intro ? `${intro}\n${question}` : `${openingPrefix}${question}`
  const combined = `${correctionPrefix}${recoveryPrefix}${answerAckPrefix}${reply}`
  return combined.trimEnd()
}

function intakeAnswerAcknowledgment(lastKind: string, body: string) {
  if (!body.trim() || isIntakeCorrection(body)) return ""
  if (lastKind === "confirm") return ""
  return "אוקיי, קיבלתי.\n"
}

function questionOrder(kind: string) {
  const order = [
    "product",
    "space",
    "bedroom",
    "children",
    "pets",
    "style",
    "sofa",
    "furniture",
    "photo",
    "budget",
    "practical",
    "confirm",
  ]
  const index = order.indexOf(kind)
  return index === -1 ? 0 : index
}

/** Customer attached a room photo during the sales quiz — never trigger order lookup. */
export function buildSalesPhotoReceivedReply(history: HistoryMessage[], body: string) {
  const ack = "תודה, קיבלתי את התמונה.\n"
  const continued = buildSalesIntakeReply(history, body)
  if (continued.includes("קיבלתי את התמונה")) return continued
  if (continued.startsWith("*הום בוט :)")) {
    const header = "*הום בוט :)*\n"
    return `${header}${ack}${continued.slice(header.length).replace(/^\n+/, "")}`
  }
  return `${ack}${continued}`
}
