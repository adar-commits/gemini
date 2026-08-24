import { generateText, jsonSchema, Output } from "ai"
import { getAgentSupabase } from "@/lib/agents/supabase"
import {
  insertLearnedRule,
  isSafeLearnedPattern,
  type LearnedRuleKind,
} from "@/lib/agents/learned-rules"
import { kbExcerptForLog } from "@/lib/landbot/shadow-deterministic"
import { isReviewFailureReason } from "@/lib/landbot/shadow-deterministic"
import { proposeDeterministicFixes } from "@/lib/landbot/shadow-autofix-deterministic"
import type { ShadowIssueType } from "@/lib/landbot/shadow-review"
import type { ShadowLogRow } from "@/lib/landbot/shadow-review"

type IssueRow = {
  review_id: string
  shadow_log_id: string
  issue_types: ShadowIssueType[]
  reason: string
  suggested_fix: string
  user_text: string
  agent: string
  action: string | null
  draft_reply: string
  kb_excerpt: string
}

const AUTO_FIX_ISSUES = new Set<ShadowIssueType>([
  "route_wrong",
  "off_topic_leak",
  "handoff_early",
  "empty_reply",
  "wrong_action",
  "tone",
  "too_long",
  "kb_missing",
  "policy_risk",
])

const FIX_MODEL_RULES = `
You turn one shadow-review issue into at most TWO learned runtime rules for a WhatsApp bot.
Rules apply at runtime WITHOUT redeploy. Prefer deterministic patterns over vague advice.

Allowed rule_kind:
- route_regex: master fast-route. pattern=JavaScript regex (case-insensitive), route_action one of ROUTE_TO_INFO_AGENT | ROUTE_TO_SALES_AGENT | ROUTE_TO_SERVICE_AGENT | ROUTE_TO_SHIPPING_STATUS
- greeting_pattern: casual hello / small talk → welcome (not off-topic)
- off_topic_exception: rule_text only — must NEVER get off-topic fallback
- prompt_rule: rule_text only — short behavior rule for agent faq|sales|service|master|all
- fast_reply: pattern + rule_text — when user message matches pattern, send rule_text (Hebrew body only, no header). Use ONLY facts from KNOWLEDGE EXCERPT.
- reply_guard: pattern matches BAD draft text; rule_text explains what to do instead

FORBID:
- inventing prices, stock, order status, or policies not in KNOWLEDGE EXCERPT
- overly broad regex like .* or .+
- duplicate obvious behavior unless the example proves a gap

Prefer minimal patterns anchored to user_text.
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
  const raw = Number(process.env.SHADOW_AUTOFIX_MAX_PER_RUN ?? "10")
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 30) : 10
}

function maxAutofixLoops() {
  const raw = Number(process.env.SHADOW_AUTOFIX_LOOPS ?? "4")
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 10) : 4
}

function autofixEnabled() {
  const raw = process.env.SHADOW_AUTOFIX_ENABLED?.trim().toLowerCase()
  return raw !== "0" && raw !== "false" && raw !== "off"
}

function isAutofixEligible(row: IssueRow) {
  if (isReviewFailureReason(row.reason)) return false
  if (row.issue_types.some((issue) => AUTO_FIX_ISSUES.has(issue))) return true
  return false
}

async function fetchUnfixedIssues(limit: number) {
  const supabase = getAgentSupabase()
  const { data: reviews, error } = await supabase
    .from("hom_agent_shadow_reviews")
    .select("id, shadow_log_id, issue_types, reason, suggested_fix")
    .eq("verdict", "issue")
    .order("reviewed_at", { ascending: true })
    .limit(limit * 4)

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
      const log = logsById.get(row.shadow_log_id) as ShadowLogRow | undefined
      const issueRow: IssueRow = {
        review_id: row.id,
        shadow_log_id: row.shadow_log_id,
        issue_types: (row.issue_types ?? []) as ShadowIssueType[],
        reason: String(row.reason ?? ""),
        suggested_fix: String(row.suggested_fix ?? ""),
        user_text: String(log?.user_text ?? ""),
        agent: String(log?.agent ?? ""),
        action: log?.action ? String(log.action) : null,
        draft_reply: String(log?.draft_reply ?? ""),
        kb_excerpt: log ? kbExcerptForLog(log) : "",
      }
      return issueRow
    })
    .filter(isAutofixEligible)
}

type ProposedFix = {
  rule_kind: LearnedRuleKind
  agent?: string
  pattern?: string
  route_action?: string
  rule_text: string
}

async function markAutofixProcessed(issue: IssueRow, note: string) {
  await insertLearnedRule({
    shadowReviewId: issue.review_id,
    ruleKind: "prompt_rule",
    agent: "all",
    ruleText: `shadow-autofix: ${note}`.slice(0, 500),
    sourceUserText: issue.user_text,
  }).catch(() => null)
}

async function applyFixes(issue: IssueRow, fixes: ProposedFix[]) {
  let applied = 0
  const ruleIds: string[] = []

  for (const fix of fixes) {
    if (
      (fix.rule_kind === "route_regex" ||
        fix.rule_kind === "greeting_pattern" ||
        fix.rule_kind === "fast_reply" ||
        fix.rule_kind === "reply_guard") &&
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
    }
  }

  return { applied, ruleIds }
}

export async function proposeLearnedFixes(issue: IssueRow) {
  const deterministic = proposeDeterministicFixes(issue)
  if (deterministic.length) return deterministic

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
          `\nKNOWLEDGE EXCERPT (only source for fast_reply facts):\n${issue.kb_excerpt.slice(0, 4000)}`,
        ].join("\n"),
      },
    ],
    maxOutputTokens: 600,
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
                    "fast_reply",
                    "reply_guard",
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
    return { ok: true, applied: 0, pending_issues: 0, processed: 0 }
  }

  let applied = 0
  let processed = 0
  const ruleIds: string[] = []

  for (const issue of issues) {
    processed += 1
    const deterministic = proposeDeterministicFixes(issue)
    const proposals =
      deterministic.length > 0 ? deterministic : await proposeLearnedFixes(issue)

    const result = await applyFixes(issue, proposals)
    applied += result.applied
    ruleIds.push(...result.ruleIds)

    if (result.applied === 0) {
      await markAutofixProcessed(
        issue,
        proposals.length ? "no safe rule passed validation" : "no fix proposed"
      )
    }
  }

  return {
    ok: true,
    applied,
    rule_ids: ruleIds,
    processed_issues: processed,
  }
}

/** Drain autofix queue — multiple batches per cron run. */
export async function runShadowAutofixDrain() {
  let totalApplied = 0
  let loops = 0
  let lastProcessed = 0

  for (let i = 0; i < maxAutofixLoops(); i += 1) {
    const lastBatch = await runShadowAutofixBatch()
    loops += 1
    totalApplied += lastBatch.applied ?? 0
    lastProcessed = lastBatch.processed_issues ?? 0
    if (lastProcessed === 0) break
  }

  return {
    ok: true,
    loops,
    total_applied: totalApplied,
    last_batch: { processed_issues: lastProcessed, applied: totalApplied },
  }
}

export async function runShadowReviewAndAutofix() {
  const { runShadowReviewBatch } = await import("@/lib/landbot/shadow-review")
  const review = await runShadowReviewBatch()
  const autofix = await runShadowAutofixDrain()
  return { review, autofix }
}
