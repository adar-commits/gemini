import type { AgentId, HistoryMessage } from "@/lib/agents/types"
import { isProductInventoryQuestion, isSpecificProductMention } from "@/lib/agents/product-handoff"
import {
  isFaqTopicSwitch,
  isSalesQuizAffirmation,
  isSalesTopicSwitch,
  isServiceTopicSwitch,
  isTopicPivotPhrase,
} from "@/lib/agents/topic-switch"
import { isHumanHandoffPending, isOffTopicQuestion } from "@/lib/agents/off-topic"
import { isShippingPolicyQuestion, isShippingStatusQuestion } from "@/lib/agents/shipping"

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
  rugSize?: string
  sofaSize?: string
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
  /תוכי|ציפור(?:ים)?|כלב(?:ה)?|חתול(?:ה)?|ארנב|ג(?:'|׳|)ר(?:י)?ז(?:י)?|ח(?:ו(?:מ)?)?ס(?:ת)?(?:ר)?|דג(?:ים)?|נחש|פר(?:ט|ט)|hamster|guinea|pets?/i

const PET_CLARIFICATION_RE =
  /^(?:אבל|רק|הוא|היא|לא\s+נכנס|בסדר|בכל\s+זאת)/i

const UNKNOWN_ANSWER_RE =
  /^(?:לא\s+יודע(?:ת)?|לא\s+בטוח(?:ה)?|לא\s+מבין|אין\s+לי\s+מושג|לא\s+ממש|לא\s+כ(?:\"|״|')?כ|עזוב(?:\s+אותי)?)/i

const INTAKE_CORRECTION_RE =
  /כבר\s+שאלת|כבר\s+עניתי|עניתי\s+ש|אמרתי\s+ש|צודק/i

const FORBIDDEN_HOUSEHOLD_Q =
  /למי\s+הסלון\s+משמש|למי\s+(?:ה)?(?:סלון|חדר)\s+משמש\s+ביום/i

const INTAKE_MARKER_RE =
  /התאמת שטיח|שאלות קצרות|האם זה נכון עד כה|יש בעלי חיים|מה התקציב|איזה סגנון|מידת הספה|לאיזה חלל|לאן השטיח מיועד|איך חדר השינה משמש/i

/** Named model/collection in a purchase message (not verified against any catalog). */
const REQUESTED_MODEL_RE =
  /(?:מחפש(?:ים|ת|ים)?\s+)?(?:לקנות\s+)?(?:שטיח|פוף)\s+([א-ת][א-תa-z0-9 \-]{1,30}?)(?=\s+ב(?:גימור|גודל)|\s+ע(?:ם|ד)|[\n,.!?]|$)/i

const PRODUCT_Q =
  "באיזה מוצר מדובר – שטיח, פוף, תמונת קיר, אביזר לעיצוב הבית, כרית או מוצר אחר?"
const SPACE_Q_RUG =
  "לאיזה חלל מיועד השטיח? (למשל סלון, חדר שינה, חצר, מרפסת, מסדרון — או כל חלל אחר)"
const SPACE_Q_OTHER =
  "לאיזה חלל מיועד המוצר? (למשל סלון, חדר שינה, חצר, מרפסת — או כל חלל אחר)"
const BEDROOM_USE_Q =
  "איך חדר השינה משמש ביום־יום – כחדר תינוקות, חדר ילדים או נוער, חדר ליחיד, חדר זוגי, חדר לאדם מבוגר או שימוש אחר?"
const CHILDREN_Q = "מדובר בילדים קטנים, ילדים גדולים או גם וגם?"
const PETS_Q = "יש בעלי חיים שנכנסים לחלל?"
const STYLE_Q =
  "איזה סגנון או תחושה מחפשים – למשל יוקרתי, מודרני, כפרי או משהו אחר?"
const SOFA_SIZE_Q = "מה מידת הספה?"
const BUDGET_Q = "מה התקציב המשוער?"
const PRACTICAL_Q =
  "יש דרישות מיוחדות – למשל שיהיה קל לניקוי/כביסה, עמיד, או משהו אחר?"

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

const ROOM_TARGET_RE =
  /^(?:לחדר\s+ילדים|חדר\s+(?:ילדים|שינה|ילד|נוער|תינוקות)|לסלון|סלון|למסדרון|מסדרון|מטבח|מרפסת|כניסה)(?:\s|$)/i

const GARBAGE_MODEL_RE =
  /^(?:בבקשה|כמה|עולה|מידה|גודל|יש|לקנות|שטיח|פוף|בגודל|במידה|אפשר|רוצה|מחפש|מסוימ(?:ת|ה)|מוצר|דגם|בבקשה\s+כמה\s+עולה)/i

export function extractRequestedModel(text: string): string | null {
  const match = text.trim().match(REQUESTED_MODEL_RE)
  if (!match) return null
  const name = match[1].trim().split(/\n/)[0].trim().replace(/\s+/g, " ")
  if (ROOM_TARGET_RE.test(name)) return null
  if (GARBAGE_MODEL_RE.test(name)) return null
  if (/^(סלון|חדר|גדול|קטן|יוקרתי|מודרני|עבה|דק|חלק|מחוספס)/i.test(name)) {
    return null
  }
  return name
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

export function hasOngoingSalesIntake(history: HistoryMessage[]) {
  return INTAKE_MARKER_RE.test(lastAssistantText(history))
}

function lastIntakeQuestionKind(history: HistoryMessage[]): string | null {
  const last = lastAssistantText(history)
  if (/לאיזה חלל|לאן השטיח/.test(last)) return "space"
  if (/באיזה מוצר/.test(last)) return "product"
  if (/איך חדר השינה/.test(last)) return "bedroom"
  if (/ילדים קטנים/.test(last)) return "children"
  if (/בעלי חיים/.test(last)) return "pets"
  if (/סגנון/.test(last)) return "style"
  if (/מידת הספה/.test(last)) return "sofa"
  if (/תקציב/.test(last)) return "budget"
  if (/דרישות מיוחדות/.test(last)) return "practical"
  if (/האם זה נכון/.test(last)) return "confirm"
  return null
}

function questionKindForText(question: string): string | null {
  if (/לאיזה חלל|לאן השטיח/.test(question)) return "space"
  if (/באיזה מוצר/.test(question)) return "product"
  if (/איך חדר השינה/.test(question)) return "bedroom"
  if (/ילדים קטנים/.test(question)) return "children"
  if (/בעלי חיים/.test(question)) return "pets"
  if (/סגנון/.test(question)) return "style"
  if (/מידת הספה/.test(question)) return "sofa"
  if (/תקציב/.test(question)) return "budget"
  if (/דרישות מיוחדות/.test(question)) return "practical"
  if (/האם זה נכון/.test(question)) return "confirm"
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
  if (isTopicPivotPhrase(trimmed)) return true
  if (isFaqTopicSwitch(trimmed)) return true
  if (isServiceTopicSwitch(trimmed)) return true
  if (isShippingPolicyQuestion(trimmed) || isShippingStatusQuestion(trimmed)) return true
  if (isProductInventoryQuestion(trimmed) || isSpecificProductMention(trimmed)) return true
  if (
    isSalesConsultationTrigger(trimmed) &&
    !hasOngoingSalesIntake(history) &&
    trimmed.split(/\s+/).length >= 4
  ) {
    return true
  }
  if (isSalesTopicSwitch(trimmed) && lastIntakeQuestionKind(history) !== null) {
    return true
  }
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
  _lastAgent: AgentId | null
) {
  if (isShippingPolicyQuestion(body) || isShippingStatusQuestion(body)) return false
  if (isFaqTopicSwitch(body)) return false
  if (isOffTopicQuestion(body)) return false
  if (isHumanHandoffPending(history)) return false
  if (isProductInventoryQuestion(body) || isSpecificProductMention(body)) return false
  if (hasUnverifiedProductRequest(body)) return false
  if (isSpecificProductQuery(body)) return false
  if (isSalesConsultationTrigger(body)) return true
  if (hasOngoingSalesIntake(history)) {
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
    replies.length === 1 && /^(?:לא|אין|בלי|ללא)(?:[\s,.!?]|$)/i.test(replies[0])
  if (clarifiedNo && !/רק\s+/i.test(combined)) {
    intake.pets = "none"
    return
  }

  if (PET_CLARIFICATION_RE.test(body) && replies.length >= 2) {
    intake.pets = "yes"
    intake.petsDetail = replies.join(", ").slice(0, 80)
  }
}

function applyContextualIntakeAnswers(
  intake: SalesIntake,
  history: HistoryMessage[],
  body: string,
  options?: { force?: boolean }
) {
  const kind = lastIntakeQuestionKind(history)
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
    const match = body.match(/([\d,]+)\s*(?:ש[\"״']?ח|₪|שקל)?/)
    if (match) intake.budget = match[1].replace(/,/g, "")
    else if (/^\d[\d,.\s]*$/.test(body.trim())) {
      intake.budget = body.trim().replace(/,/g, "")
    }
  }

  if ((kind === "practical" || options?.force) && !intake.practicalNeeds) {
    const trimmed = body.trim()
    if (trimmed.length >= 2 && trimmed.length <= 80) {
      intake.practicalNeeds = trimmed
    }
  }

  if ((kind === "sofa" || options?.force) && !intake.sofaSize && !intake.rugSize) {
    const match = body.match(/(\d\s*[-–]\s*\d|\d(?:\.\d)?)\s*מ(?:טר)?/)
    if (match) intake.sofaSize = match[1].replace(/\s/g, "")
    else if (/^\d[\d.\s-]*$/.test(body.trim())) {
      intake.sofaSize = body.trim()
    }
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

/** Collect user reply/ies that follow a bot intake question in the thread. */
function userAnswersAfter(
  messages: HistoryMessage[],
  assistantIndex: number
): string[] {
  const answers: string[] = []
  for (let index = assistantIndex + 1; index < messages.length; index += 1) {
    const message = messages[index]
    if (message.role === "assistant") break
    if (message.role === "user") answers.push(message.content.trim())
  }
  return answers.filter(Boolean)
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

function applyStyleAnswer(intake: SalesIntake, answers: string[]) {
  const combined = answers.join(" ")
  if (!combined) return
  if (isUnknownIntakeAnswer(combined)) {
    intake.style = "לא בטוח — יועץ יעזור בבחירה"
    return
  }
  if (/יוקרתי/.test(combined)) intake.style = "יוקרתי"
  else if (/מודרני/.test(combined)) intake.style = "מודרני"
  else if (/כפרי/.test(combined)) intake.style = "כפרי"
  else intake.style = answers[answers.length - 1].slice(0, 50)
}

function applyPetsAnswerFromText(intake: SalesIntake, answers: string[]) {
  const combined = answers.join(" ")
  if (!combined) return

  if (PET_ANIMAL_RE.test(combined) || /רק\s+[א-תa-z]/i.test(combined)) {
    intake.pets = "yes"
    intake.petsDetail =
      answers.length > 1
        ? answers.join(", ").slice(0, 80)
        : combined.match(
            /(?:רק\s+)?(תוכי|ציפור(?:ים)?|כלב(?:ה)?|חתול(?:ה)?|[א-ת]{2,12})/i
          )?.[1] || combined.slice(0, 40)
    return
  }

  if (/^(?:כן|yes)/i.test(answers[answers.length - 1] ?? "")) {
    intake.pets = "yes"
    return
  }

  if (
    answers.every((answer) => /^(?:לא|אין|בלי|ללא)(?:[\s,.!?]|$)/i.test(answer)) &&
    !/רק\s+/i.test(combined)
  ) {
    intake.pets = "none"
    return
  }

  if (PET_CLARIFICATION_RE.test(answers[answers.length - 1] ?? "") && answers.length >= 2) {
    intake.pets = "yes"
    intake.petsDetail = answers.join(", ").slice(0, 80)
  }
}

/** Walk Q→A pairs in thread so answers persist across later turns. */
function walkIntakeFromHistory(history: HistoryMessage[], body: string): SalesIntake {
  const intake: SalesIntake = {}
  const messages: HistoryMessage[] = [...history, { role: "user", content: body }]

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]
    if (message.role !== "assistant") continue

    const kind = questionKindForText(message.content)
    if (!kind) continue

    const answers = userAnswersAfter(messages, index)
    if (answers.length === 0) continue

    const combined = answers.join(" ")

    switch (kind) {
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
      case "sofa": {
        const match = combined.match(/(\d\s*[-–]\s*\d|\d(?:\.\d)?)\s*מ(?:טר)?/)
        if (match) intake.sofaSize = match[1].replace(/\s/g, "")
        else if (!isUnknownIntakeAnswer(combined)) intake.sofaSize = answers[answers.length - 1]
        break
      }
      case "budget": {
        const match =
          combined.match(/([\d,]+)\s*(?:ש[\"״']?ח|₪|שקל)/i) ||
          combined.match(/(\d[\d,]+)/)
        if (match) intake.budget = match[1].replace(/,/g, "")
        else if (!isUnknownIntakeAnswer(combined)) {
          intake.budget = answers[answers.length - 1].replace(/,/g, "")
        }
        break
      }
      case "practical":
        if (isUnknownIntakeAnswer(combined)) {
          intake.practicalNeeds = "לא בטוח — יועץ יבדוק"
        } else {
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
  return /לאיזה חלל|לאן השטיח/.test(lastAssistantText(history))
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
    if (/ללא\s+חיות|אין\s+חיות|בלי\s+חיות|לא\s+יש\s+חיות/.test(text)) {
      intake.pets = "none"
    } else if (/יש\s+(?:כלב|חתול|חיות)|עם\s+חיות|כלב|חתול/.test(text)) {
      intake.pets = "yes"
    }
  }

  if (!intake.rugSize) {
    const rugSizeMatch = text.match(/(\d\s*[-–]\s*\d|\d(?:\.\d)?)\s*מ(?:טר)?/)
    if (rugSizeMatch) intake.rugSize = `${rugSizeMatch[1].replace(/\s/g, "")} מטר`
  }

  if (!intake.sofaSize) {
    const sofaMatch = text.match(/ספה\s+(?:של\s+)?(\d\s*[-–]\s*\d|\d(?:\.\d)?)\s*מ(?:טר)?/)
    if (sofaMatch) intake.sofaSize = sofaMatch[1].replace(/\s/g, "")
  }

  if (!intake.practicalNeeds && /כבס|ניקוי|עמיד|קל\s+לניקוי/.test(text)) {
    intake.practicalNeeds = "ניתן לכבס / קל לניקוי"
  }

  applyContextualIntakeAnswers(intake, history, body)

  if (!intake.targetSpace && wasSpaceQuestionAsked(history)) {
    const trimmed = body.trim()
    if (
      trimmed.length >= 2 &&
      trimmed.length <= 50 &&
      !isUnknownIntakeAnswer(trimmed) &&
      !/^(?:כן|לא)(?:[\s,.!?]|$)/i.test(trimmed)
    ) {
      applySpaceAnswer(intake, [trimmed])
    }
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

function nextIntakeQuestion(intake: SalesIntake): string | null {
  if (!intake.product) return PRODUCT_Q
  if (!intake.targetSpace) return spaceQuestion(intake)
  if (intake.targetSpace === "חדר שינה" && !intake.bedroomUse) return BEDROOM_USE_Q
  if (intake.household?.includes("ילד") && !intake.childrenAge) return CHILDREN_Q
  if (intake.pets == null && intake.product === "שטיח") return PETS_Q
  if (!intake.style) return STYLE_Q
  const isLivingRoom =
    intake.targetSpace === "סלון" || /^סלון/i.test(intake.targetSpace)
  if (isLivingRoom && intake.product === "שטיח" && !intake.rugSize && !intake.sofaSize) {
    return SOFA_SIZE_Q
  }
  if (!intake.budget) return BUDGET_Q
  if (needsPracticalNeeds(intake) && !intake.practicalNeeds) return PRACTICAL_Q
  return null
}

function isPriceFirstFlow(text: string) {
  return /תקציב|עד\s+[\d,]+|כמה\s+עולה|מה\s+יש\s+ב/.test(text)
}

function introForFlow(text: string, history: HistoryMessage[], intake: SalesIntake) {
  const started = hasOngoingSalesIntake(history)
  if (started) return ""
  if (
    (intake.requestedModel || hasUnverifiedProductRequest(text)) &&
    !isSalesConsultationTrigger(text)
  ) {
    return ""
  }
  if (isPriceFirstFlow(text)) {
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
  if (/^(כן|נכון|בדיוק|מדויק|yes)/i.test(trimmed)) {
    return "מעולה. האם להעביר את הפנייה כעת ליועץ מכירות ועיצוב אנושי?"
  }
  return buildConfirmationSummary(extractSalesIntake(history, body))
}

export function buildConfirmationSummary(intake: SalesIntake) {
  const parts: string[] = []

  if (intake.product && intake.targetSpace) {
    parts.push(`אנחנו מחפשים ${intake.product} ל${intake.targetSpace}`)
  }

  if (intake.bedroomUse) {
    parts.push(`(${intake.bedroomUse})`)
  }

  if (intake.requestedModel) {
    parts.push(`עם עניין בדגם/רעיון "${intake.requestedModel}" (לבדיקה ע"י יועץ)`)
  }

  if (intake.style) {
    parts.push(`בסגנון ${intake.style}`)
  }

  const size = intake.rugSize || (intake.sofaSize ? `ספה ${intake.sofaSize} מטר` : "")
  if (size) {
    parts.push(`בגודל ${size.includes("מטר") ? size : `${size} מטר`}`)
  }

  if (intake.pets === "none") {
    parts.push("ללא חיות מחמד")
  } else if (intake.pets === "yes") {
    parts.push(intake.petsDetail ? `עם ${intake.petsDetail}` : "עם חיות מחמד בבית")
  }

  if (intake.household?.includes("ילד") || intake.childrenAge) {
    const ageText = intake.childrenAge ? ` בגילאי ${intake.childrenAge}` : ""
    parts.push(`עם ילדים${ageText}`)
  } else if (intake.household) {
    parts.push(`עבור ${intake.household}`)
  }

  if (intake.budget) {
    parts.push(`עד תקציב של ${formatBudget(intake.budget)} ש״ח`)
  }

  if (intake.practicalNeeds) {
    parts.push(`וחשוב ש${intake.practicalNeeds}`)
  }

  return `אוקיי, אז ממה שאני מבין ${parts.join(", ")}. האם זה נכון עד כה?`
}

export function isConfirmationPending(history: HistoryMessage[]) {
  return /האם זה נכון עד כה/.test(lastAssistantText(history))
}

export function sanitizeSalesReply(reply: string, history: HistoryMessage[], body: string) {
  if (!FORBIDDEN_HOUSEHOLD_Q.test(reply)) return reply
  return buildSalesIntakeReply(history, body)
}

export function buildSalesIntakeReply(history: HistoryMessage[], body: string) {
  const intake = extractSalesIntake(history, body)
  const intro = introForFlow(body, history, intake)

  let next = nextIntakeQuestion(intake)
  const lastKind = lastIntakeQuestionKind(history)
  const nextKind = next ? questionKindForText(next) : null

  // Never repeat the same question — accept the reply and advance.
  if (next && lastKind && nextKind === lastKind) {
    applyContextualIntakeAnswers(intake, history, body, { force: true })
    next = nextIntakeQuestion(intake)
  }

  // Never go backwards (e.g. re-ask space after style was already asked).
  if (next && lastKind && nextKind && questionOrder(nextKind) < questionOrder(lastKind)) {
    applyContextualIntakeAnswers(intake, history, body, { force: true })
    next = nextIntakeQuestion(intake)
  }

  const correctionPrefix = isIntakeCorrection(body) ? "צודק/ת, תודה על הסבלנות.\n" : ""

  if (!next) {
    return correctionPrefix + buildConfirmationSummary(intake)
  }

  const reply = intro ? `${intro}\n${next}` : next
  return correctionPrefix ? `${correctionPrefix}${reply}` : reply
}

function questionOrder(kind: string) {
  const order = ["product", "space", "bedroom", "children", "pets", "style", "sofa", "budget", "practical", "confirm"]
  const index = order.indexOf(kind)
  return index === -1 ? 0 : index
}
