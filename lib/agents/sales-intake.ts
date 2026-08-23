import type { AgentId, HistoryMessage } from "@/lib/agents/types"

export type SalesIntake = {
  product?: string
  targetSpace?: string
  household?: string
  childrenAge?: string
  pets?: "none" | "yes"
  style?: string
  rugSize?: string
  sofaSize?: string
  budget?: string
  practicalNeeds?: string
}

const CONSULTATION_RE =
  /מחפש(?:ים|ת|ים)?|רוצ(?:ה|ים|ות)\s+לקנות|תקציב|עד\s+[\d,]+|כמה\s+עולה|מה\s+יש|עוזר\s+לבחור|ייעוץ|מתלבט|בין\s+שני|התאמ(?:ה|ת)|גודל\s+מתאים/i

const SPECIFIC_PRODUCT_RE =
  /דגם|sku|קזבלנקה|גארדה|collection|www\.|carpetshop\.co\.il\/products/i

const INTAKE_MARKER_RE =
  /התאמת שטיח|שאלות קצרות|האם זה נכון עד כה|למי הסלון משמש|יש בעלי חיים|מה התקציב|איזה סגנון|מידת הספה/i

const PRODUCT_Q =
  "באיזה מוצר מדובר – שטיח, פוף, תמונה, כרית או מוצר אחר?"
const SPACE_Q =
  "לאיזה חלל השטיח מיועד – סלון, חדר שינה, חדר ילדים, מסדרון או חלל אחר?"
const HOUSEHOLD_Q =
  "למי הסלון משמש ביום־יום – לזוג, למשפחה עם ילדים, לאדם מבוגר או להרכב אחר?"
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

export function isSpecificProductQuery(text: string) {
  return SPECIFIC_PRODUCT_RE.test(text.trim())
}

export function isSalesConsultationTrigger(text: string) {
  return CONSULTATION_RE.test(text.trim())
}

export function hasOngoingSalesIntake(history: HistoryMessage[]) {
  return INTAKE_MARKER_RE.test(lastAssistantText(history))
}

export function shouldUseSalesIntakeFastPath(
  body: string,
  history: HistoryMessage[],
  lastAgent: AgentId | null
) {
  if (isSpecificProductQuery(body)) return false
  if (isSalesConsultationTrigger(body)) return true
  if (lastAgent === "sales" && hasOngoingSalesIntake(history)) return true
  return false
}

export function extractSalesIntake(history: HistoryMessage[], body: string): SalesIntake {
  const text = allUserText(history, body)
  const intake: SalesIntake = {}

  if (/שטיח/.test(text)) intake.product = "שטיח"
  else if (/פוף/.test(text)) intake.product = "פוף"
  else if (/כרית/.test(text)) intake.product = "כרית"
  else if (/תמונה/.test(text)) intake.product = "תמונה"

  if (/סלון/.test(text)) intake.targetSpace = "סלון"
  else if (/חדר שינה/.test(text)) intake.targetSpace = "חדר שינה"
  else if (/חדר ילדים/.test(text)) intake.targetSpace = "חדר ילדים"
  else if (/מסדרון/.test(text)) intake.targetSpace = "מסדרון"

  const budgetMatch =
    text.match(/עד\s+([\d,]+)\s*(?:ש[\"״']?ח|₪)?/i) ||
    text.match(/תקציב(?:\s+של)?\s+([\d,]+)/i)
  if (budgetMatch) intake.budget = budgetMatch[1].replace(/,/g, "")

  if (/משפחה\s+עם\s+ילדים|ילדים\s+קטנים|יש\s+ילדים|עם\s+ילדים/.test(text)) {
    intake.household = "משפחה עם ילדים"
  } else if (/לזוג|זוג(\s|$)/.test(text)) {
    intake.household = "זוג"
  } else if (/מבוגר/.test(text)) {
    intake.household = "אדם מבוגר"
  }

  const childrenAgeMatch = text.match(/גיל(?:אי)?\s*([\d]+(?:\s*[-–]\s*[\d]+)?)/)
  if (childrenAgeMatch) intake.childrenAge = childrenAgeMatch[1].replace(/\s/g, "")
  else if (/ילדים\s+קטנים/.test(text)) intake.childrenAge = "קטנים"
  else if (/ילדים\s+גדולים/.test(text)) intake.childrenAge = "גדולים"

  if (/ללא\s+חיות|אין\s+חיות|בלי\s+חיות|לא\s+יש\s+חיות/.test(text)) {
    intake.pets = "none"
  } else if (/יש\s+(?:כלב|חתול|חיות)|עם\s+חיות|כלב|חתול/.test(text)) {
    intake.pets = "yes"
  }

  if (/יוקרתי/.test(text)) intake.style = "יוקרתי"
  else if (/מודרני/.test(text)) intake.style = "מודרני"
  else if (/כפרי/.test(text)) intake.style = "כפרי"

  const rugSizeMatch = text.match(/(\d\s*[-–]\s*\d|\d(?:\.\d)?)\s*מ(?:טר)?/)
  if (rugSizeMatch) intake.rugSize = `${rugSizeMatch[1].replace(/\s/g, "")} מטר`

  const sofaMatch = text.match(/ספה\s+(?:של\s+)?(\d\s*[-–]\s*\d|\d(?:\.\d)?)\s*מ(?:טר)?/)
  if (sofaMatch) intake.sofaSize = sofaMatch[1].replace(/\s/g, "")

  if (/כבס|ניקוי|עמיד|קל\s+לניקוי/.test(text)) {
    intake.practicalNeeds = "ניתן לכבס / קל לניקוי"
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

function nextIntakeQuestion(intake: SalesIntake): string | null {
  if (!intake.product) return PRODUCT_Q
  if (!intake.targetSpace) return SPACE_Q
  if (intake.targetSpace === "סלון" && !intake.household) return HOUSEHOLD_Q
  if (intake.household?.includes("ילד") && !intake.childrenAge) return CHILDREN_Q
  if (intake.pets == null) return PETS_Q
  if (!intake.style) return STYLE_Q
  if (intake.targetSpace === "סלון" && !intake.rugSize && !intake.sofaSize) {
    return SOFA_SIZE_Q
  }
  if (!intake.budget) return BUDGET_Q
  if (needsPracticalNeeds(intake) && !intake.practicalNeeds) return PRACTICAL_Q
  return null
}

function isPriceFirstFlow(text: string) {
  return /תקציב|עד\s+[\d,]+|כמה\s+עולה|מה\s+יש\s+ב/.test(text)
}

function introForFlow(text: string, history: HistoryMessage[]) {
  const started = hasOngoingSalesIntake(history)
  if (started) return ""
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
    parts.push("עם חיות מחמד בבית")
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

export function buildSalesIntakeReply(history: HistoryMessage[], body: string) {
  const intake = extractSalesIntake(history, body)
  const intro = introForFlow(body, history)
  const next = nextIntakeQuestion(intake)

  if (!next) {
    return buildConfirmationSummary(intake)
  }

  return intro ? `${intro}\n${next}` : next
}
