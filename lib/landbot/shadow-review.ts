import { generateText, jsonSchema, Output } from "ai"
import { getAgentSupabase } from "@/lib/agents/supabase"
import {
  classifyShadowLogDeterministic,
  heuristicShadowOkVerdict,
  isReviewFailureReason,
  kbExcerptForLog,
} from "@/lib/landbot/shadow-deterministic"

export const SHADOW_ISSUE_TYPES = [
  "route_wrong",
  "handoff_early",
  "empty_reply",
  "kb_missing",
  "tone",
  "policy_risk",
  "off_topic_leak",
  "wrong_action",
  "too_long",
] as const

export type ShadowIssueType = (typeof SHADOW_ISSUE_TYPES)[number]

export type ShadowReviewVerdict = {
  verdict: "ok" | "issue"
  issue_types: ShadowIssueType[]
  reason: string
  suggested_fix: string
}

export type ShadowLogRow = {
  id: string
  conversation_id: string
  customer_id: number | null
  phone: string | null
  user_text: string
  agent: string
  action: string | null
  draft_reply: string
  replied: boolean
  created_at: string
}

const REVIEW_RULES = `
You review HoM GROUP WhatsApp bot SHADOW drafts (what the bot would have sent; customer did NOT receive it).

Flag issues when the draft violates any rule:
- Dissatisfaction without defect ("לא מרוצה", "לא מתאים") → FAQ agent + exchange/return info, NOT service/human_service on first turn.
- Defect / missing / wrong item → service agent; collect intake before human_service.
- human_service or human_sales on first customer message ONLY if they explicitly ask for a human (נציג / נציגה / שיחה עם נציג).
- human_service / human_sales must include a short Hebrew handoff line in draft_reply (not empty).
- Casual greetings (שלום, היי, מה נשמע) on opening turn → warm welcome, NOT off-topic fallback.
- Branch list questions (איזה סניפים / return to branch) → list all branches from KB with address and phone.
- Off-topic (trivia, politics, unrelated) → exact reply starting with *הום בוט :)* then "לא הצלחתי להבין את השאלה, נסה שוב" — do not answer the off-topic question.
- Customer-facing draft_reply should start with *הום בוט :)* (except silent routing-only actions with empty reply on master).
- Do not invent prices, stock, order status, or policies not supported by the knowledge excerpt.
- action=shipping is OK only for clear shipment-status questions; bot cannot look up orders yet — reply should set expectation or ask for order details, not invent tracking.
- Hebrew, concise, professional tone for Israeli retail.

verdict=ok when the draft is reasonable for the message and rules above.
verdict=issue when any material problem exists.

issue_types: use only from: ${SHADOW_ISSUE_TYPES.join(", ")} (empty array if ok).
reason: one short sentence in Hebrew for the operator.
suggested_fix: one short sentence — what to change (prompt / kb / route-intent / none).
`.trim()

function reviewModel() {
  return (
    process.env.SHADOW_REVIEW_MODEL?.trim() ||
    process.env.AGENT_ROUTER_MODEL?.trim() ||
    process.env.AGENT_MODEL?.trim() ||
    "google/gemini-2.5-flash-lite"
  )
}

function batchSize() {
  const raw = Number(process.env.SHADOW_REVIEW_BATCH_SIZE ?? "10")
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 30) : 10
}

function reviewEnabled() {
  const raw = process.env.SHADOW_REVIEW_ENABLED?.trim().toLowerCase()
  return raw !== "0" && raw !== "false" && raw !== "off"
}

async function conversationTurnCount(conversationId: string) {
  const supabase = getAgentSupabase()
  const { count, error } = await supabase
    .from("hom_agent_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .eq("role", "user")

  if (error) return 0
  return count ?? 0
}

function reviewRetryDelayMs(attempt: number) {
  return Math.min(2000 * 2 ** attempt, 15000)
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export async function reviewShadowLog(
  log: ShadowLogRow,
  turnNumber: number
): Promise<ShadowReviewVerdict & { model: string; deterministic?: boolean }> {
  const deterministic = classifyShadowLogDeterministic(log)
  if (deterministic) {
    return { ...deterministic, model: "deterministic" }
  }

  const model = reviewModel()
  const kbExcerpt = kbExcerptForLog(log)

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const result = await generateText({
        model,
        system: REVIEW_RULES,
        messages: [
          {
            role: "user",
            content: [
              `Customer turn #${turnNumber} in conversation ${log.conversation_id}`,
              `Phone: ${log.phone ?? "unknown"}`,
              `User message:\n${log.user_text}`,
              `Chosen agent: ${log.agent}`,
              `Action: ${log.action ?? "(none)"}`,
              `Draft reply:\n${log.draft_reply || "(empty)"}`,
              `\nKnowledge excerpt:\n${kbExcerpt}`,
            ].join("\n\n"),
          },
        ],
        maxOutputTokens: 300,
        output: Output.object({
          name: "shadow_log_review",
          schema: jsonSchema<ShadowReviewVerdict>({
            type: "object",
            additionalProperties: false,
            required: ["verdict", "issue_types", "reason", "suggested_fix"],
            properties: {
              verdict: { type: "string", enum: ["ok", "issue"] },
              issue_types: {
                type: "array",
                items: { type: "string", enum: [...SHADOW_ISSUE_TYPES] },
              },
              reason: { type: "string" },
              suggested_fix: { type: "string" },
            },
          }),
        }),
      })

      let verdict: ShadowReviewVerdict = {
        verdict: "ok",
        issue_types: [],
        reason: "",
        suggested_fix: "",
      }
      try {
        verdict = result.output as ShadowReviewVerdict
      } catch {
        verdict = {
          verdict: "issue",
          issue_types: ["policy_risk"],
          reason: "לא ניתן לפרסר את תוצאת הביקורת האוטומטית.",
          suggested_fix: "none",
        }
      }

      if (verdict.verdict === "ok") {
        verdict.issue_types = []
      } else if (!verdict.issue_types.length) {
        verdict.issue_types = ["policy_risk"]
      }

      return { ...verdict, model }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const rateLimited = /rate limit|429|GatewayRateLimit/i.test(message)
      if (rateLimited && attempt < 3) {
        await sleep(reviewRetryDelayMs(attempt))
        continue
      }
      throw error
    }
  }

  throw new Error("Shadow review exhausted retries")
}

async function fetchUnreviewedLogs(limit: number) {
  const supabase = getAgentSupabase()
  const pageSize = Math.max(limit * 2, 50)
  let offset = 0
  const unreviewed: ShadowLogRow[] = []

  while (unreviewed.length < limit) {
    const { data: logs, error } = await supabase
      .from("hom_agent_shadow_logs")
      .select(
        "id, conversation_id, customer_id, phone, user_text, agent, action, draft_reply, replied, created_at"
      )
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) throw error
    const rows = (logs ?? []) as ShadowLogRow[]
    if (!rows.length) break

    const ids = rows.map((row) => row.id)
    const { data: reviewed, error: reviewedError } = await supabase
      .from("hom_agent_shadow_reviews")
      .select("shadow_log_id")
      .in("shadow_log_id", ids)

    if (reviewedError) throw reviewedError
    const done = new Set((reviewed ?? []).map((row) => row.shadow_log_id))

    for (const row of rows) {
      if (!done.has(row.id)) {
        unreviewed.push(row)
        if (unreviewed.length >= limit) break
      }
    }

    offset += pageSize
    if (rows.length < pageSize) break
  }

  return unreviewed
}

function deterministicBatchSize() {
  const raw = Number(process.env.SHADOW_DETERMINISTIC_BATCH_SIZE ?? "500")
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 2000) : 500
}

/** Drain unreviewed logs using code-only rules (no AI, no rate limits). */
export async function runDeterministicShadowReviewBatch(limit = deterministicBatchSize()) {
  const logs = await fetchUnreviewedLogs(limit)
  if (!logs.length) {
    const stats = await shadowReviewStats()
    return { ok: true, reviewed: 0, issues: 0, ok_count: 0, pending: stats.pending }
  }

  const supabase = getAgentSupabase()
  let reviewed = 0
  let issues = 0
  let okCount = 0

  for (const log of logs) {
    const verdict =
      classifyShadowLogDeterministic(log) ?? heuristicShadowOkVerdict(log)
    if (!verdict) continue

    const { error } = await supabase.from("hom_agent_shadow_reviews").insert({
      shadow_log_id: log.id,
      verdict: verdict.verdict,
      issue_types: verdict.issue_types,
      reason: verdict.reason.slice(0, 500),
      suggested_fix: verdict.suggested_fix.slice(0, 500),
      model: "deterministic",
    })

    if (error) {
      if (error.code === "23505") continue
      throw error
    }

    reviewed += 1
    if (verdict.verdict === "issue") issues += 1
    else okCount += 1
  }

  const stats = await shadowReviewStats()
  return {
    ok: true,
    reviewed,
    issues,
    ok_count: okCount,
    skipped_inconclusive: logs.length - reviewed,
    pending: stats.pending,
  }
}

export async function runShadowReviewBatch() {
  if (!reviewEnabled()) {
    return { ok: true, skipped: "disabled", reviewed: 0, issues: 0 }
  }

  const logs = await fetchUnreviewedLogs(batchSize())
  if (!logs.length) {
    const stats = await shadowReviewStats()
    return { ok: true, reviewed: 0, issues: 0, pending: stats.pending }
  }

  const supabase = getAgentSupabase()
  let reviewed = 0
  let issues = 0
  const issueIds: string[] = []

  for (const log of logs) {
    try {
      const turnNumber = (await conversationTurnCount(log.conversation_id)) || 1
      const review = await reviewShadowLog(log, turnNumber)

      const { error } = await supabase.from("hom_agent_shadow_reviews").insert({
        shadow_log_id: log.id,
        verdict: review.verdict,
        issue_types: review.issue_types,
        reason: review.reason.slice(0, 500),
        suggested_fix: review.suggested_fix.slice(0, 500),
        model: review.model,
      })

      if (error) {
        if (error.code === "23505") continue
        throw error
      }

      reviewed += 1
      if (review.verdict === "issue") {
        issues += 1
        issueIds.push(log.id)
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Shadow review failed for log"
      console.error("[shadow-review] log failed", log.id, message)

      // Do not store rate-limit failures as policy_risk — leave log unreviewed for retry
      if (/rate limit|429|GatewayRateLimit/i.test(message)) {
        continue
      }

      const { error: insertError } = await supabase
        .from("hom_agent_shadow_reviews")
        .insert({
          shadow_log_id: log.id,
          verdict: "issue",
          issue_types: ["policy_risk"],
          reason: `ביקורת אוטומטית נכשלה: ${message}`.slice(0, 500),
          suggested_fix: "none",
          model: reviewModel(),
        })

      if (!insertError || insertError.code === "23505") {
        reviewed += 1
        issues += 1
        issueIds.push(log.id)
      }
    }
  }

  return { ok: true, reviewed, issues, issue_ids: issueIds }
}

export async function listRecentShadowIssues(limit = 20) {
  const supabase = getAgentSupabase()
  const { data: reviews, error } = await supabase
    .from("hom_agent_shadow_reviews")
    .select("id, shadow_log_id, verdict, issue_types, reason, suggested_fix, reviewed_at, model")
    .eq("verdict", "issue")
    .order("reviewed_at", { ascending: false })
    .limit(limit)

  if (error) throw error
  if (!reviews?.length) return []

  const logIds = reviews.map((row) => row.shadow_log_id)
  const { data: logs, error: logsError } = await supabase
    .from("hom_agent_shadow_logs")
    .select("id, user_text, agent, action, draft_reply, phone, created_at")
    .in("id", logIds)

  if (logsError) throw logsError
  const byId = new Map((logs ?? []).map((log) => [log.id, log]))

  return reviews.map((review) => ({
    ...review,
    log: byId.get(review.shadow_log_id) ?? null,
  }))
}

export async function resetFailedShadowReviews() {
  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_shadow_reviews")
    .select("id, reason")
    .like("reason", "ביקורת אוטומטית נכשלה%")

  if (error) throw error
  const ids = (data ?? [])
    .filter((row) => isReviewFailureReason(String(row.reason ?? "")))
    .map((row) => row.id)
  if (!ids.length) return { deleted: 0 }

  const { error: deleteError } = await supabase
    .from("hom_agent_shadow_reviews")
    .delete()
    .in("id", ids)

  if (deleteError) throw deleteError
  return { deleted: ids.length }
}

export async function shadowReviewStats() {
  const supabase = getAgentSupabase()
  const [{ count: pending }, { count: issues }, { count: reviewed }] =
    await Promise.all([
      supabase
        .from("hom_agent_shadow_logs")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("hom_agent_shadow_reviews")
        .select("id", { count: "exact", head: true })
        .eq("verdict", "issue"),
      supabase
        .from("hom_agent_shadow_reviews")
        .select("id", { count: "exact", head: true }),
    ])

  const totalLogs = pending ?? 0
  const totalReviewed = reviewed ?? 0
  return {
    shadow_logs: totalLogs,
    reviewed: totalReviewed,
    pending: Math.max(totalLogs - totalReviewed, 0),
    flagged_issues: issues ?? 0,
    enabled: reviewEnabled(),
    batch_size: batchSize(),
    model: reviewModel(),
  }
}
