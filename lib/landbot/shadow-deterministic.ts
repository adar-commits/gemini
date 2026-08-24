import { selectFaqKb } from "@/lib/agents/kb"
import {
  isShippingPolicyQuestion,
  isShippingStatusQuestion,
} from "@/lib/agents/shipping"
import type { ShadowIssueType, ShadowLogRow, ShadowReviewVerdict } from "@/lib/landbot/shadow-review"

const FORBIDDEN_HOUSEHOLD =
  /למי\s+הסלון\s+משמש|למי\s+(?:ה)?סלון\s+משמש\s+ביום/i

const CUSTOMER_HEADER = "*הום בוט :)*"

function hasHeader(reply: string) {
  return reply.includes(CUSTOMER_HEADER) || reply.trim().startsWith("הום בוט :)")
}

/** Code-based QA — no AI, no rate limits. Returns null when inconclusive. */
export function deterministicShadowVerdict(
  log: ShadowLogRow
): (ShadowReviewVerdict & { deterministic: true }) | null {
  const user = log.user_text.trim()
  const draft = log.draft_reply.trim()
  const action = log.action ?? ""
  const issues: ShadowIssueType[] = []
  const reasons: string[] = []
  const fixes: string[] = []

  if (
    (action === "shipping" || action === "ROUTE_TO_SHIPPING_STATUS") &&
    !draft
  ) {
    issues.push("empty_reply", "wrong_action")
    reasons.push("פעולת shipping ללא תשובה ללקוח.")
    fixes.push("route-intent + shipping reply template")
  }

  if (isShippingPolicyQuestion(user) && log.agent === "sales" && action === "reply") {
    issues.push("wrong_action", "kb_missing")
    reasons.push("שאלת מדיניות משלוח נענתה בתוך sales intake במקום FAQ.")
    fixes.push("route shipping policy to FAQ / fast_reply from KB")
  }

  if (isShippingStatusQuestion(user) && log.agent === "sales" && /לאיזה\s+חלל|שטיח\s+מיועד/i.test(draft)) {
    issues.push("wrong_action")
    reasons.push("שאלת סטטוס/עיכוב משלוח הופנתה לשאלון מכירות.")
    fixes.push("route to shipping status flow")
  }

  if (FORBIDDEN_HOUSEHOLD.test(draft)) {
    issues.push("wrong_action", "tone")
    reasons.push('שאלה אסורה: "למי הסלון משמש".')
    fixes.push("sales intake — space first, no household for salon")
  }

  if (
    draft &&
    action === "reply" &&
    log.agent !== "master" &&
    !hasHeader(draft) &&
    !/^(כן|לא|אוקיי)/i.test(draft)
  ) {
    issues.push("tone")
    reasons.push("חסר כותרת *הום בוט :)* בתשובה.")
    fixes.push("normalize reply header")
  }

  if (
    action === "human_service" ||
    action === "human_sales"
  ) {
    if (!draft) {
      issues.push("empty_reply")
      reasons.push("handoff לנציג ללא הודעה ללקוח.")
      fixes.push("handoff confirmation line required")
    }
  }

  if (issues.length === 0) return null

  return {
    deterministic: true,
    verdict: "issue",
    issue_types: [...new Set(issues)],
    reason: reasons.join(" "),
    suggested_fix: fixes.join("; "),
  }
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
