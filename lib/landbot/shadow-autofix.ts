import { generateText, jsonSchema, Output } from "ai"
import { getAgentSupabase } from "@/lib/agents/supabase"
import {
  insertLearnedRule,
  isSafeLearnedPattern,
  type LearnedRuleKind,
} from "@/lib/agents/learned-rules"
import type { ShadowIssueType } from "@/lib/landbot/shadow-review"

type IssueRow = {
  review_id: string
  issue_types: ShadowIssueType[]
  reason: string
  suggested_fix: string
  user_text: string
  agent: string
  action: string | null
  draft_reply: string
}

const AUTO_FIX_ISSUES = new Set<ShadowIssueType>([
  "route_wrong",
  "off_topic_leak",
  "handoff_early",
  "empty_reply",
  "wrong_action",
  "tone",
])

const FIX_MODEL_RULES = `
You turn one shadow-review issue into at most TWO learned runtime rules for a WhatsApp bot.
Output rules that can be applied WITHOUT editing policy/KB facts.

Allowed rule_kind:
- route_regex: master fast-route. pattern=JavaScript regex (case-insensitive), route_action one of ROUTE_TO_INFO_AGENT | ROUTE_TO_SALES_AGENT | ROUTE_TO_SERVICE_AGENT | ROUTE_TO_SHIPPING_STATUS
- greeting_pattern: pattern matches casual hello / small talk to trigger welcome (not off-topic)
- off_topic_exception: rule_text only — phrase/pattern class that must NEVER get the off-topic fallback
- prompt_rule: rule_text only — short behavior rule for agent faq|sales|service|master|all

FORBID:
- inventing return/shipping/pricing policy
- kb_missing fixes (skip — human must update KB)
- policy_risk fixes (skip)
- overly broad regex like .* or .+
- duplicate of obvious existing behavior unless the example proves a gap

Prefer minimal, testable patterns anchored to the example user_text.
`.trim()

function autofixModel() {
  return (
    process.env.SHADOW_AUTOFIX_MODEL?.trim() ||
    process.env.SHADOW_REVIEW_MODEL?.trim() ||
    process.env.AGENT_ROUTER_MODEL?.trim() ||
    "google/gemini-2.5-flash-lite"
  )
}

function maxFixesPerRun() {
  const raw = Number(process.env.SHADOW_AUTOFIX_MAX_PER_RUN ?? "8")
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 20) : 8
}

function autofixEnabled() {
  const raw = process.env.SHADOW_AUTOFIX_ENABLED?.trim().toLowerCase()
  return raw !== "0" && raw !== "false" && raw !== "off"
}

async function fetchUnfixedIssues(limit: number) {
  const supabase = getAgentSupabase()
  const { data: reviews, error } = await supabase
    .from("hom_agent_shadow_reviews")
    .select("id, shadow_log_id, issue_types, reason, suggested_fix")
    .eq("verdict", "issue")
    .order("reviewed_at", { ascending: true })
    .limit(limit * 3)

  if (error) throw error
  if (!reviews?.length) return []

  const reviewIds = reviews.map((row) => row.id)
  const { data: existing, error: existingError } = await supabase
    .from("hom_agent_learned_rules")
    .select("shadow_review_id")
    .in("shadow_review_id", reviewIds)

  if (existingError) throw existingError
  const done = new Set((existing ?? []).map((row) => row.shadow_review_id))

  const pending = reviews.filter((row) => !done.has(row.id)).slice(0, limit)
  if (!pending.length) return []

  const logIds = pending.map((row) => row.shadow_log_id)
  const { data: logs, error: logsError } = await supabase
    .from("hom_agent_shadow_logs")
    .select("id, user_text, agent, action, draft_reply")
    .in("id", logIds)

  if (logsError) throw logsError
  const logsById = new Map((logs ?? []).map((log) => [log.id, log]))

  return pending
    .map((row) => {
      const log = logsById.get(row.shadow_log_id)
      return {
        review_id: row.id,
        issue_types: (row.issue_types ?? []) as ShadowIssueType[],
        reason: String(row.reason ?? ""),
        suggested_fix: String(row.suggested_fix ?? ""),
        user_text: String(log?.user_text ?? ""),
        agent: String(log?.agent ?? ""),
        action: log?.action ? String(log.action) : null,
        draft_reply: String(log?.draft_reply ?? ""),
      }
    })
    .filter((row) =>
      row.issue_types.some((issue) => AUTO_FIX_ISSUES.has(issue))
    )
}

type ProposedFix = {
  rule_kind: LearnedRuleKind
  agent?: string
  pattern?: string
  route_action?: string
  rule_text: string
}

export async function proposeLearnedFixes(issue: IssueRow) {
  const result = await generateText({
    model: autofixModel(),
    system: FIX_MODEL_RULES,
    messages: [
      {
        role: "user",
        content: [
          `issue_types: ${issue.issue_types.join(", ")}`,
          `reason: ${issue.reason}`,
          `suggested_fix: ${issue.suggested_fix}`,
          `user_text: ${issue.user_text}`,
          `agent: ${issue.agent}`,
          `action: ${issue.action ?? ""}`,
          `draft_reply: ${issue.draft_reply}`,
        ].join("\n"),
      },
    ],
    maxOutputTokens: 500,
    output: Output.object({
      name: "learned_fixes",
      schema: jsonSchema<{ fixes: ProposedFix[] }>({
        type: "object",
        additionalProperties: false,
        required: ["fixes"],
        properties: {
          fixes: {
            type: "array",
            maxItems: 2,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["rule_kind", "rule_text"],
              properties: {
                rule_kind: {
                  type: "string",
                  enum: [
                    "route_regex",
                    "greeting_pattern",
                    "prompt_rule",
                    "off_topic_exception",
                  ],
                },
                agent: { type: "string" },
                pattern: { type: "string" },
                route_action: { type: "string" },
                rule_text: { type: "string" },
              },
            },
          },
        },
      }),
    }),
  })

  try {
    return (result.output as { fixes: ProposedFix[] }).fixes ?? []
  } catch {
    return []
  }
}

export async function runShadowAutofixBatch() {
  if (!autofixEnabled()) {
    return { ok: true, skipped: "disabled", applied: 0 }
  }

  const issues = await fetchUnfixedIssues(maxFixesPerRun())
  if (!issues.length) {
    return { ok: true, applied: 0, pending_issues: 0 }
  }

  let applied = 0
  const ruleIds: string[] = []

  for (const issue of issues) {
    const proposals = await proposeLearnedFixes(issue)
    let insertedForReview = false

    for (const fix of proposals) {
      if (
        (fix.rule_kind === "route_regex" || fix.rule_kind === "greeting_pattern") &&
        (!fix.pattern || !isSafeLearnedPattern(fix.pattern))
      ) {
        continue
      }

      if (fix.rule_kind === "route_regex" && !fix.route_action) continue
      if (!fix.rule_text?.trim()) continue

      const id = await insertLearnedRule({
        shadowReviewId: issue.review_id,
        ruleKind: fix.rule_kind,
        agent: fix.agent ?? "all",
        pattern: fix.pattern ?? null,
        routeAction: fix.route_action ?? null,
        ruleText: fix.rule_text.trim(),
        sourceUserText: issue.user_text,
      }).catch(() => null)

      if (id) {
        applied += 1
        ruleIds.push(id)
        insertedForReview = true
      }
    }

    if (!insertedForReview && proposals.length === 0) {
      await insertLearnedRule({
        shadowReviewId: issue.review_id,
        ruleKind: "prompt_rule",
        agent: issue.agent || "all",
        ruleText: `Review noted: ${issue.reason}. ${issue.suggested_fix}`.slice(0, 500),
        sourceUserText: issue.user_text,
      }).catch(() => null)
    }
  }

  return { ok: true, applied, rule_ids: ruleIds, processed_issues: issues.length }
}

export async function runShadowReviewAndAutofix() {
  const { runShadowReviewBatch } = await import("@/lib/landbot/shadow-review")
  const review = await runShadowReviewBatch()
  const autofix = await runShadowAutofixBatch()
  return { review, autofix }
}
