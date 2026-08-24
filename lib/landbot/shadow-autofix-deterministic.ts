import { buildShippingPolicyReply, buildShippingStatusReply } from "@/lib/agents/shipping"
import {
  isShippingPolicyQuestion,
  isShippingStatusQuestion,
} from "@/lib/agents/shipping"
import type { LearnedRuleKind } from "@/lib/agents/learned-rules"
import type { ShadowIssueType } from "@/lib/landbot/shadow-review"

export type DeterministicFix = {
  rule_kind: LearnedRuleKind
  agent?: string
  pattern?: string
  route_action?: string
  rule_text: string
}

const SHIPPING_POLICY_PATTERN =
  "כמה\\s+(?:ימים|זמן)\\s+(?:לוקח|נמשך)\\s+(?:ה)?משלוח|זמ(?:ן|ני)\\s+(?:אספקה|משלוח)|(?:מה|כמה)\\s+(?:עולה|עלות)\\s+(?:ה)?משלוח"

const SHIPPING_STATUS_PATTERN =
  "מתי\\s+(?:זה\\s+)?(?:יגיע|מגיע)|איפה\\s+(?:ה)?(?:משלוח|הזמנה)|סטטוס\\s+(?:ה)?(?:משלוח|הזמנה)|(?:ה)?(?:משלוח|אספקה).*(?:מ\\s*\\d|עד\\s+\\d|איחור)"

function stripHeader(text: string) {
  return text.replace(/^\*הום בוט :\)\*\n?/, "").trim()
}

export function proposeDeterministicFixes(input: {
  issue_types: ShadowIssueType[]
  reason: string
  user_text: string
  agent: string
  action: string | null
  draft_reply: string
}): DeterministicFix[] {
  const fixes: DeterministicFix[] = []
  const user = input.user_text.trim()

  if (
    input.issue_types.includes("wrong_action") &&
    (isShippingPolicyQuestion(user) ||
      (input.agent === "sales" && /משלוח|אספקה|ימי\s+עסקים/i.test(input.reason + input.draft_reply)))
  ) {
    fixes.push({
      rule_kind: "route_regex",
      pattern: SHIPPING_POLICY_PATTERN,
      route_action: "ROUTE_TO_INFO_AGENT",
      rule_text: "Shipping policy questions → FAQ (delivery times/cost), never sales intake.",
    })
    fixes.push({
      rule_kind: "fast_reply",
      agent: "faq",
      pattern: SHIPPING_POLICY_PATTERN,
      rule_text: stripHeader(buildShippingPolicyReply()),
    })
  }

  if (
    input.issue_types.includes("empty_reply") &&
    (input.action === "shipping" || isShippingStatusQuestion(user))
  ) {
    fixes.push({
      rule_kind: "route_regex",
      pattern: SHIPPING_STATUS_PATTERN,
      route_action: "ROUTE_TO_SHIPPING_STATUS",
      rule_text: "Order tracking / arrival questions → shipping status flow.",
    })
    fixes.push({
      rule_kind: "fast_reply",
      agent: "faq",
      pattern: SHIPPING_STATUS_PATTERN,
      rule_text: stripHeader(buildShippingStatusReply()),
    })
  }

  if (
    input.issue_types.includes("wrong_action") &&
    isShippingStatusQuestion(user) &&
    input.agent === "sales"
  ) {
    fixes.push({
      rule_kind: "route_regex",
      pattern: SHIPPING_STATUS_PATTERN,
      route_action: "ROUTE_TO_SHIPPING_STATUS",
      rule_text: "Mid sales quiz: delivery status questions leave sales → shipping.",
    })
  }

  if (/למי\s+הסלון\s+משמש|למי\s+הסלון/i.test(input.draft_reply + input.reason)) {
    fixes.push({
      rule_kind: "prompt_rule",
      agent: "sales",
      rule_text:
        'FORBIDDEN: never ask "למי הסלון משמש". After space is known, ask pets/style/size — not household composition for the living room.',
    })
    fixes.push({
      rule_kind: "reply_guard",
      agent: "sales",
      pattern: "למי\\s+הסלון\\s+משמש",
      rule_text: "Replace forbidden living-room household question with next intake step.",
    })
  }

  if (input.issue_types.includes("handoff_early")) {
    fixes.push({
      rule_kind: "prompt_rule",
      agent: "all",
      rule_text:
        "Do not human_service/human_sales on first turn unless customer explicitly asks for a representative (נציג/נציגה).",
    })
  }

  if (input.issue_types.includes("off_topic_leak")) {
    fixes.push({
      rule_kind: "prompt_rule",
      agent: "all",
      rule_text:
        "Off-topic questions: reply only with *הום בוט :)* then לא הצלחתי להבין את השאלה, נסה שוב — never answer the unrelated question.",
    })
  }

  return fixes
}
