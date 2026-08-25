import { selectFaqKb } from "@/lib/agents/kb"
import { isWhatsappAutoresponder } from "@/lib/agents/autoresponder"
import { isCustomerServiceOpener } from "@/lib/agents/customer-service-opener"
import {
  isConversationClosing,
  isNonSubstantiveFollowUp,
} from "@/lib/agents/conversation-close"
import { isDissatisfactionWithoutDefect } from "@/lib/agents/dissatisfaction"
import { isServiceTopicSwitch } from "@/lib/agents/topic-switch"
import {
  isProductInventoryQuestion,
  isSpecificProductMention,
} from "@/lib/agents/product-handoff"
import {
  isShippingPolicyQuestion,
  isShippingStatusQuestion,
} from "@/lib/agents/shipping"
import type { ShadowIssueType, ShadowLogRow, ShadowReviewVerdict } from "@/lib/landbot/shadow-review"

const CUSTOMER_HEADER = "*הום בוט :)*"

const FORBIDDEN_HOUSEHOLD =
  /למי\s+הסלון\s+משמש|למי\s+(?:ה)?סלון\s+משמש\s+ביום/i

const FAKE_STOCK_REPLY_RE =
  /אבדוק(?:\s+(?:א(?:ם|ת)|ע(?:ם|ד))?|\s+ב)?(?:מלאי|זמינות)|בודק(?:ים)?\s+(?:ב)?(?:מלאי|זמינות)|(?:יש|קיים)\s+(?:ל(?:כם|נו)\s+)?(?:ב)?(?:מלאי|זמינות)/i

const SALES_INTAKE_RE = /לאיזה\s+חלל|יש\s+בעלי\s+חיים|שטיח\s+מיועד|תקציב\s+שחשבת/i

const CS_TOPIC_PROMPT_RE = /כיצד\s+א(?:וכ|ו)ל\s+לעזור|פרט(?:\s+את|\s+לי)?\s+(?:את\s+)?נושא\s+הפנייה/i

const HANDOFF_LINE_RE = /הועבר(?:ה|ו)?\s+ל(?:נציג|יועץ|שירות)|העבר(?:תי|נו)\s+א(?:ת|ת)?\s+הפנייה/i

const GREETING_REPLY_RE =
  /ברוכ(?:ים|ה)\s+הבא|שמח(?:ה|ים)\s+ל(?:עזור|ראות)|מה\s+נ(?:שמע|וכל)|איך\s+א(?:וכ|ו)ל\s+לעזור/i

function hasHeader(reply: string) {
  return reply.includes(CUSTOMER_HEADER) || reply.trim().startsWith("הום בוט :)")
}

function hasDoubleHeader(reply: string) {
  return /^\*הום בוט :\)\*\s*\*הום בוט/i.test(reply.trim())
}

function okVerdict(reason: string): ShadowReviewVerdict & { deterministic: true } {
  return {
    deterministic: true,
    verdict: "ok",
    issue_types: [],
    reason,
    suggested_fix: "none",
  }
}

function issueVerdict(
  issueTypes: ShadowIssueType[],
  reason: string,
  fix: string
): ShadowReviewVerdict & { deterministic: true } {
  return {
    deterministic: true,
    verdict: "issue",
    issue_types: [...new Set(issueTypes)],
    reason,
    suggested_fix: fix,
  }
}

/** Code-based QA — no AI, no rate limits. Returns ok, issue, or null when inconclusive. */
export function classifyShadowLogDeterministic(
  log: ShadowLogRow
): (ShadowReviewVerdict & { deterministic: true }) | null {
  const user = log.user_text.trim()
  const draft = log.draft_reply.trim()
  const action = log.action ?? ""

  if (isWhatsappAutoresponder(user)) {
    return issueVerdict(
      ["off_topic_leak"],
      "הודעת autoresponder מעסק אחר — לא לענות.",
      "autoresponder detection — no reply"
    )
  }

  if (
    (action === "shipping" || action === "ROUTE_TO_SHIPPING_STATUS") &&
    !draft
  ) {
    return issueVerdict(
      ["empty_reply", "wrong_action"],
      "פעולת shipping ללא תשובה ללקוח.",
      "route-intent + shipping reply template"
    )
  }

  if (hasDoubleHeader(draft)) {
    return issueVerdict(
      ["tone"],
      "כותרת *הום בוט :)* כפולה בתשובה.",
      "normalizeReply — dedupe header"
    )
  }

  if (isCustomerServiceOpener(user) && CS_TOPIC_PROMPT_RE.test(draft)) {
    return okVerdict("שירות לקוחות — בקשת נושא הפנייה (תקין).")
  }

  if (
    isCustomerServiceOpener(user) &&
    (action === "shipping" || action === "ROUTE_TO_SHIPPING_STATUS")
  ) {
    return issueVerdict(
      ["wrong_action", "empty_reply"],
      "שירות לקוחות הופנה ל-shipping במקום בקשת נושא.",
      "customer-service-opener → topic prompt"
    )
  }

  if (isShippingPolicyQuestion(user) && log.agent === "sales" && action === "reply") {
    return issueVerdict(
      ["wrong_action", "kb_missing"],
      "שאלת מדיניות משלוח נענתה בתוך sales intake.",
      "route shipping policy to FAQ"
    )
  }

  if (
    isShippingStatusQuestion(user) &&
    log.agent === "sales" &&
    SALES_INTAKE_RE.test(draft)
  ) {
    return issueVerdict(
      ["wrong_action"],
      "שאלת סטטוס/עיכוב משלוח הופנתה לשאלון מכירות.",
      "route to shipping status flow"
    )
  }

  if (isShippingStatusQuestion(user) && draft && action !== "shipping") {
    return okVerdict("שאלת משלוח — תשובה לא ריקה (תקין).")
  }

  if (isShippingStatusQuestion(user) && draft && action === "shipping") {
    return okVerdict("שאלת משלוח — תבנית shipping עם תשובה (תקין).")
  }

  if (FORBIDDEN_HOUSEHOLD.test(draft)) {
    return issueVerdict(
      ["wrong_action", "tone"],
      'שאלה אסורה: "למי הסלון משמש".',
      "sales intake — space first, no household for salon"
    )
  }

  if (isServiceTopicSwitch(user) && log.agent === "sales" && SALES_INTAKE_RE.test(draft)) {
    return issueVerdict(
      ["route_wrong", "wrong_action"],
      "תלונה/זיכוי/התאמת מחיר — הופנה לשאלון מכירות.",
      "break sales sticky on isServiceTopicSwitch"
    )
  }

  if (isDissatisfactionWithoutDefect(user) && log.agent === "sales") {
    return issueVerdict(
      ["route_wrong"],
      "אי-שביעות רצון ללא פגם — הופנה למכירות במקום FAQ החזרה.",
      "isDissatisfactionWithoutDefect → FAQ rescue"
    )
  }

  if (
    (isConversationClosing(user) || isNonSubstantiveFollowUp(user)) &&
    (action === "human_service" || action === "human_sales")
  ) {
    return issueVerdict(
      ["handoff_early"],
      "סגירת שיחה או סימן שאלה — לא להעביר לנציג.",
      "isConversationClosing / isNonSubstantiveFollowUp → end or ack"
    )
  }

  if (isConversationClosing(user) && action === "end" && draft) {
    return okVerdict("סגירת שיחה — אישור וסיום (תקין).")
  }

  if (
    (isProductInventoryQuestion(user) || isSpecificProductMention(user)) &&
    log.agent === "faq" &&
    FAKE_STOCK_REPLY_RE.test(draft)
  ) {
    return issueVerdict(
      ["policy_risk", "kb_missing"],
      "שאלת מוצר/מלאי — FAQ המציא זמינות או מחיר.",
      "product handoff — no fake stock"
    )
  }

  if (
    (isProductInventoryQuestion(user) || isSpecificProductMention(user)) &&
    /קישור לדף|אין לי גישה|יועץ מכירות|האם להעביר/i.test(draft)
  ) {
    return okVerdict("שאלת מוצר — בקשת קישור או העברה ליועץ (תקין).")
  }

  if (
    action === "human_service" &&
    isServiceTopicSwitch(user) &&
    HANDOFF_LINE_RE.test(draft)
  ) {
    return okVerdict("תלונה/שירות — העברה לנציג עם הודעה (תקין).")
  }

  if (
    draft &&
    action === "reply" &&
    log.agent !== "master" &&
    !hasHeader(draft) &&
    !/^(כן|לא|אוקיי)/i.test(draft)
  ) {
    return issueVerdict(
      ["tone"],
      "חסר כותרת *הום בוט :)* בתשובה.",
      "normalize reply header"
    )
  }

  if (
    action === "human_service" ||
    action === "human_sales"
  ) {
    if (!draft) {
      return issueVerdict(
        ["empty_reply"],
        "handoff לנציג ללא הודעה ללקוח.",
        "handoff confirmation line required"
      )
    }
  }

  if (
    /^(?:שלום|היי|הי|אהלן|מה\s+נשמע)/i.test(user) &&
    action === "reply" &&
    GREETING_REPLY_RE.test(draft)
  ) {
    return okVerdict("ברכה — תשובת פתיחה (תקין).")
  }

  if (isDissatisfactionWithoutDefect(user) && log.agent === "faq" && /החלפ|החזר|returns\.carpetshop/i.test(draft)) {
    return okVerdict("אי-שביעות רצון — מדיניות החזרה (תקין).")
  }

  return null
}

/** @deprecated Use classifyShadowLogDeterministic — issue-only wrapper for backwards compat. */
export function deterministicShadowVerdict(
  log: ShadowLogRow
): (ShadowReviewVerdict & { deterministic: true }) | null {
  const verdict = classifyShadowLogDeterministic(log)
  if (!verdict || verdict.verdict === "ok") return null
  return verdict
}

/** Conservative pass for backlog drain — marks clearly fine drafts without AI. */
export function heuristicShadowOkVerdict(
  log: ShadowLogRow
): (ShadowReviewVerdict & { deterministic: true }) | null {
  const issue = classifyShadowLogDeterministic(log)
  if (issue?.verdict === "issue") return null

  const user = log.user_text.trim()
  const draft = log.draft_reply.trim()
  const action = log.action ?? ""

  if (!user) return null
  if (action === "end" && draft) {
    return okVerdict("heuristic: סיום שיחה עם תשובה.")
  }
  if (action === "reply" && draft && hasHeader(draft)) {
    if (FAKE_STOCK_REPLY_RE.test(draft) && log.agent === "faq") return null
    if (FORBIDDEN_HOUSEHOLD.test(draft)) return null
    return okVerdict("heuristic: תשובת reply עם כותרת תקינה.")
  }
  if (
    (action === "human_service" || action === "human_sales") &&
    draft &&
    HANDOFF_LINE_RE.test(draft)
  ) {
    return okVerdict("heuristic: handoff עם שורת העברה.")
  }
  if (action === "shipping" && draft) {
    return okVerdict("heuristic: shipping עם תשובה.")
  }

  return null
}

export function isReviewFailureReason(reason: string) {
  return (
    reason.includes("ביקורת אוטומטית נכשלה") ||
    reason.includes("GatewayRateLimit") ||
    reason.includes("rate limit")
  )
}

export function kbExcerptForLog(log: ShadowLogRow) {
  return selectFaqKb(log.user_text).slice(0, 6000)
}
