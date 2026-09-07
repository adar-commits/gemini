import { randomUUID } from "node:crypto"
import { generateText, jsonSchema, Output } from "ai"
import {
  insertLearnedRule,
  isSafeLearnedPattern,
  type LearnedRuleKind,
} from "@/lib/agents/learned-rules"
import { getAgentSupabase } from "@/lib/agents/supabase"

export const GOKU_CLOSE_REASONS = [
  "inactivity_close",
  "reset",
  "end",
  "stale_expire",
] as const

export type GokuCloseReason = (typeof GOKU_CLOSE_REASONS)[number]

export type GokuSuggestionType = "learned_rule" | "kb_edit" | "prompt_edit"

export type GokuSuggestionStatus = "proposed" | "applied" | "rejected"

export type GokuSuggestion = {
  id: string
  type: GokuSuggestionType
  confidence: number
  title: string
  description: string
  rule_kind?: LearnedRuleKind
  agent?: string
  pattern?: string
  route_action?: string
  rule_text?: string
  status: GokuSuggestionStatus
  applied_rule_id?: string | null
}

export type GokuTurnCritique = {
  turn_index: number
  user_text: string
  issue: string
  fix: string
}

export type GokuAnalysis = {
  strengths: string[]
  weaknesses: string[]
  turn_critiques: GokuTurnCritique[]
  kb_gaps: string[]
  routing_issues: string[]
  tone_issues: string[]
  missed_tools: string[]
}

export type GokuReportRow = {
  id: string
  conversation_id: string
  close_reason: GokuCloseReason
  summary: string
  grade: number
  analysis: GokuAnalysis
  suggestions: GokuSuggestion[]
  applied_rule_ids: string[]
  model: string | null
  created_at: string
}

type TranscriptTurn = {
  role: "user" | "assistant"
  content: string
  agent?: string
  action?: string
  created_at?: string
}

type ShadowContextRow = {
  user_text: string
  draft_reply: string
  agent: string
  action: string | null
  verdict: string | null
  reason: string | null
  suggested_fix: string | null
}

type GokuLlmOutput = {
  summary: string
  grade: number
  analysis: GokuAnalysis
  suggestions: Array<{
    type: GokuSuggestionType
    confidence: number
    title: string
    description: string
    rule_kind?: LearnedRuleKind
    agent?: string
    pattern?: string
    route_action?: string
    rule_text?: string
  }>
}

const GOKU_SYSTEM_PROMPT = `
You are GOKU_TRAINER — an elite QA coach for HoM GROUP's Hebrew WhatsApp bot (הום בוט).
Your job: review a COMPLETE closed conversation and produce actionable retraining guidance.

## Architecture you must respect
- T0 = exact deterministic answers (URLs, API lookups, policy snippets)
- guessMasterRoute = department routing before Master LLM
- LLM = ambiguous routing or KB synthesis only
- Production target: routing_mode hybrid

## Must NOT match pairs (always test both sides)
| A | B |
|---|---|
| refund timeline | return location |
| branch review link | branch address/hours |
| return policy | return execution (Service) |
| dissatisfaction | defect |

## Review checklist
1. Per-turn routing: was the right department/action chosen?
2. Tool usage: missed order lookup, branch list, review link, return policy?
3. Hebrew tone: concise, warm Israeli retail — not a form, not emotional theater
4. Policy safety: no invented prices, stock, order status, or policies
5. Handoff timing: human_service/human_sales only when appropriate
6. KB gaps: facts the bot should know but didn't have
7. Collision risks: phrases that could misroute (refund vs return-location, etc.)

## Output suggestions
- learned_rule: machine-actionable runtime rule (preferred for repeatable fixes)
  Allowed rule_kind: route_regex, greeting_pattern, prompt_rule, off_topic_exception, fast_reply, reply_guard
  For route_regex: pattern = JS regex (case-insensitive), route_action one of ROUTE_TO_INFO_AGENT | ROUTE_TO_SALES_AGENT | ROUTE_TO_SERVICE_AGENT | ROUTE_TO_SHIPPING_STATUS
  For fast_reply: only facts explicitly supported by the transcript — never invent
  Prefer minimal anchored patterns; forbid .* or .+
- kb_edit: markdown addition/fix for lib/agents/kb/*.md (describe exactly what to add)
- prompt_edit: change to hom-bot.md system prompt (describe exactly what to change)

grade: 1-10 overall conversation quality (10 = flawless).
summary: 2-3 Hebrew sentences for the operator.
analysis fields in Hebrew where customer-facing; technical routing notes can be English.
confidence: 0-1 how sure you are the suggestion fixes a real gap (not nitpick).
Max 6 suggestions; prioritize highest-impact fixes first.
`.trim()

const FULL_TRANSCRIPT_LIMIT = 120
const SWEEP_BATCH_SIZE = 8

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function safeConversationId(value: string) {
  return value.replace(/[,()]/g, "").slice(0, 200)
}

export function isGokuTrainerEnabled() {
  const raw = process.env.GOKU_TRAINER_ENABLED?.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "on"
}

export function gokuTrainerModel() {
  return (
    process.env.GOKU_TRAINER_MODEL?.trim() ||
    process.env.AGENT_MODEL?.trim() ||
    "anthropic/claude-opus-4.5"
  )
}

export function gokuAutoApplyConfidence() {
  const raw = Number(process.env.GOKU_AUTO_APPLY_CONFIDENCE ?? "0.85")
  if (!Number.isFinite(raw)) return 0.85
  return Math.min(1, Math.max(0, raw))
}

function gokuOutputSchema() {
  return Output.object({
    name: "goku_trainer_report",
    schema: jsonSchema<GokuLlmOutput>({
      type: "object",
      additionalProperties: false,
      required: ["summary", "grade", "analysis", "suggestions"],
      properties: {
        summary: { type: "string" },
        grade: { type: "number", minimum: 1, maximum: 10 },
        analysis: {
          type: "object",
          additionalProperties: false,
          required: [
            "strengths",
            "weaknesses",
            "turn_critiques",
            "kb_gaps",
            "routing_issues",
            "tone_issues",
            "missed_tools",
          ],
          properties: {
            strengths: { type: "array", items: { type: "string" } },
            weaknesses: { type: "array", items: { type: "string" } },
            turn_critiques: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["turn_index", "user_text", "issue", "fix"],
                properties: {
                  turn_index: { type: "number" },
                  user_text: { type: "string" },
                  issue: { type: "string" },
                  fix: { type: "string" },
                },
              },
            },
            kb_gaps: { type: "array", items: { type: "string" } },
            routing_issues: { type: "array", items: { type: "string" } },
            tone_issues: { type: "array", items: { type: "string" } },
            missed_tools: { type: "array", items: { type: "string" } },
          },
        },
        suggestions: {
          type: "array",
          maxItems: 6,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["type", "confidence", "title", "description"],
            properties: {
              type: {
                type: "string",
                enum: ["learned_rule", "kb_edit", "prompt_edit"],
              },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              title: { type: "string" },
              description: { type: "string" },
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
  })
}

async function loadSessionMeta(conversationId: string) {
  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_sessions")
    .select(
      "reset_at, last_agent, inactivity_closed_at, conversation_summary, customer_name, customer_phone"
    )
    .eq("conversation_id", conversationId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function loadFullConversationTranscript(
  conversationId: string
): Promise<TranscriptTurn[]> {
  conversationId = safeConversationId(conversationId)
  const session = await loadSessionMeta(conversationId)
  const resetAt = asText(session?.reset_at) || null

  const supabase = getAgentSupabase()
  let query = supabase
    .from("hom_agent_messages")
    .select("role, content, created_at, agent, action")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(FULL_TRANSCRIPT_LIMIT)

  if (resetAt) query = query.gt("created_at", resetAt)

  const { data, error } = await query
  if (error) throw error

  return (data ?? [])
    .filter((row) => row.role === "user" || row.role === "assistant")
    .map((row) => ({
      role: row.role as "user" | "assistant",
      content: asText(row.content),
      agent: asText(row.agent) || undefined,
      action: asText(row.action) || undefined,
      created_at: asText(row.created_at) || undefined,
    }))
    .filter((row) => row.content)
}

async function loadShadowContext(conversationId: string): Promise<ShadowContextRow[]> {
  const supabase = getAgentSupabase()
  const { data: logs, error: logsError } = await supabase
    .from("hom_agent_shadow_logs")
    .select("id, user_text, draft_reply, agent, action")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(20)

  if (logsError) throw logsError
  if (!logs?.length) return []

  const logIds = logs.map((row) => row.id)
  const { data: reviews, error: reviewsError } = await supabase
    .from("hom_agent_shadow_reviews")
    .select("shadow_log_id, verdict, reason, suggested_fix")
    .in("shadow_log_id", logIds)

  if (reviewsError) throw reviewsError
  const reviewByLog = new Map(
    (reviews ?? []).map((row) => [row.shadow_log_id, row])
  )

  return logs.map((log) => {
    const review = reviewByLog.get(log.id)
    return {
      user_text: asText(log.user_text),
      draft_reply: asText(log.draft_reply),
      agent: asText(log.agent),
      action: log.action ? asText(log.action) : null,
      verdict: review?.verdict ? asText(review.verdict) : null,
      reason: review?.reason ? asText(review.reason) : null,
      suggested_fix: review?.suggested_fix ? asText(review.suggested_fix) : null,
    }
  })
}

async function reportExists(conversationId: string) {
  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_goku_reports")
    .select("id")
    .eq("conversation_id", conversationId)
    .maybeSingle()

  if (error) {
    if (error.code === "42P01") return false
    throw error
  }
  return Boolean(data?.id)
}

function formatTranscriptForPrompt(transcript: TranscriptTurn[]) {
  if (!transcript.length) return "(empty conversation)"
  return transcript
    .map((turn, index) => {
      const meta = [
        turn.agent ? `agent=${turn.agent}` : "",
        turn.action ? `action=${turn.action}` : "",
      ]
        .filter(Boolean)
        .join(" ")
      const prefix = meta ? `[${index + 1}] ${turn.role} (${meta})` : `[${index + 1}] ${turn.role}`
      return `${prefix}: ${turn.content}`
    })
    .join("\n")
}

function formatShadowForPrompt(rows: ShadowContextRow[]) {
  if (!rows.length) return "(no shadow reviews for this conversation)"
  return rows
    .slice(0, 12)
    .map((row, index) =>
      [
        `[shadow ${index + 1}] user: ${row.user_text}`,
        `draft: ${row.draft_reply.slice(0, 400)}`,
        `agent=${row.agent} action=${row.action ?? ""}`,
        row.verdict ? `verdict=${row.verdict} reason=${row.reason ?? ""}` : "",
        row.suggested_fix ? `suggested_fix=${row.suggested_fix}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n")
}

function normalizeSuggestions(
  raw: GokuLlmOutput["suggestions"]
): GokuSuggestion[] {
  return raw.map((item) => ({
    id: randomUUID(),
    type: item.type,
    confidence: Math.min(1, Math.max(0, item.confidence)),
    title: item.title.trim(),
    description: item.description.trim(),
    rule_kind: item.rule_kind,
    agent: item.agent?.trim(),
    pattern: item.pattern?.trim(),
    route_action: item.route_action?.trim(),
    rule_text: item.rule_text?.trim(),
    status: "proposed" as const,
    applied_rule_id: null,
  }))
}

export function isValidLearnedRuleSuggestion(suggestion: GokuSuggestion) {
  if (suggestion.type !== "learned_rule") return false
  if (!suggestion.rule_kind || !suggestion.rule_text?.trim()) return false

  if (
    (suggestion.rule_kind === "route_regex" ||
      suggestion.rule_kind === "greeting_pattern" ||
      suggestion.rule_kind === "fast_reply" ||
      suggestion.rule_kind === "reply_guard") &&
    (!suggestion.pattern || !isSafeLearnedPattern(suggestion.pattern))
  ) {
    return false
  }

  if (suggestion.rule_kind === "route_regex" && !suggestion.route_action) {
    return false
  }

  return true
}

async function applyLearnedSuggestion(
  reportId: string,
  suggestion: GokuSuggestion,
  sourceUserText?: string
) {
  if (!isValidLearnedRuleSuggestion(suggestion) || !suggestion.rule_kind) {
    return null
  }

  return insertLearnedRule({
    gokuReportId: reportId,
    source: "goku_trainer",
    ruleKind: suggestion.rule_kind,
    agent: suggestion.agent ?? "all",
    pattern: suggestion.pattern ?? null,
    routeAction: suggestion.route_action ?? null,
    ruleText: suggestion.rule_text!.trim(),
    sourceUserText: sourceUserText ?? null,
  })
}

export async function analyzeConversationWithGoku(input: {
  conversationId: string
  closeReason: GokuCloseReason
  transcript: TranscriptTurn[]
  sessionSummary?: string | null
  shadowContext?: ShadowContextRow[]
  model?: string
}) {
  const model = input.model ?? gokuTrainerModel()
  const userContent = [
    `close_reason: ${input.closeReason}`,
    input.sessionSummary ? `session_summary: ${input.sessionSummary}` : "",
    `\nTRANSCRIPT:\n${formatTranscriptForPrompt(input.transcript)}`,
    `\nSHADOW QA CONTEXT:\n${formatShadowForPrompt(input.shadowContext ?? [])}`,
  ]
    .filter(Boolean)
    .join("\n")

  const result = await generateText({
    model,
    system: GOKU_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
    maxOutputTokens: 4000,
    temperature: 0.2,
    output: gokuOutputSchema(),
  })

  const output = result.output as GokuLlmOutput
  const grade = Math.min(10, Math.max(1, Math.round(output.grade)))
  return {
    model,
    summary: output.summary.trim(),
    grade,
    analysis: output.analysis,
    suggestions: normalizeSuggestions(output.suggestions ?? []),
  }
}

async function hybridApplySuggestions(
  reportId: string,
  suggestions: GokuSuggestion[],
  transcript: TranscriptTurn[]
) {
  const threshold = gokuAutoApplyConfidence()
  const appliedRuleIds: string[] = []
  const lastUserText =
    [...transcript].reverse().find((turn) => turn.role === "user")?.content ?? null

  for (const suggestion of suggestions) {
    if (suggestion.type !== "learned_rule") continue
    if (suggestion.confidence < threshold) continue

    const ruleId = await applyLearnedSuggestion(
      reportId,
      suggestion,
      lastUserText ?? undefined
    ).catch(() => null)

    if (ruleId) {
      suggestion.status = "applied"
      suggestion.applied_rule_id = ruleId
      appliedRuleIds.push(ruleId)
    }
  }

  return { suggestions, appliedRuleIds }
}

export async function runGokuTrainer(
  conversationId: string,
  closeReason: GokuCloseReason
) {
  if (!isGokuTrainerEnabled()) {
    return { ok: true, skipped: "disabled" as const }
  }

  conversationId = safeConversationId(conversationId)
  if (!conversationId) {
    return { ok: false, error: "missing_conversation_id" as const }
  }

  if (await reportExists(conversationId)) {
    return { ok: true, skipped: "already_reported" as const }
  }

  const [transcript, session, shadowContext] = await Promise.all([
    loadFullConversationTranscript(conversationId),
    loadSessionMeta(conversationId),
    loadShadowContext(conversationId),
  ])

  if (transcript.length < 2) {
    return { ok: true, skipped: "too_short" as const }
  }

  const analysis = await analyzeConversationWithGoku({
    conversationId,
    closeReason,
    transcript,
    sessionSummary: asText(session?.conversation_summary) || null,
    shadowContext,
  })

  const reportId = randomUUID()
  const hybrid = await hybridApplySuggestions(
    reportId,
    analysis.suggestions,
    transcript
  )

  const supabase = getAgentSupabase()
  const { error } = await supabase.from("hom_agent_goku_reports").insert({
    id: reportId,
    conversation_id: conversationId,
    close_reason: closeReason,
    summary: analysis.summary,
    grade: analysis.grade,
    analysis: analysis.analysis,
    suggestions: hybrid.suggestions,
    applied_rule_ids: hybrid.appliedRuleIds,
    model: analysis.model,
  })

  if (error) throw error

  console.log("[goku-trainer] report saved", {
    conversationId,
    closeReason,
    grade: analysis.grade,
    applied: hybrid.appliedRuleIds.length,
    proposed: hybrid.suggestions.filter((s) => s.status === "proposed").length,
  })

  return {
    ok: true,
    report_id: reportId,
    grade: analysis.grade,
    applied_rules: hybrid.appliedRuleIds.length,
    proposed: hybrid.suggestions.filter((s) => s.status === "proposed").length,
  }
}

/** Fire-and-forget — never blocks the reply path. */
export function scheduleGokuTrainer(
  conversationId: string,
  closeReason: GokuCloseReason
) {
  if (!isGokuTrainerEnabled()) return
  void runGokuTrainer(conversationId, closeReason).catch((error) => {
    console.error("[goku-trainer] failed", {
      conversationId,
      closeReason,
      error: error instanceof Error ? error.message : error,
    })
  })
}

export async function listGokuReports(input?: {
  limit?: number
  conversationId?: string
}) {
  const supabase = getAgentSupabase()
  const limit = Math.min(Math.max(input?.limit ?? 20, 1), 100)

  let query = supabase
    .from("hom_agent_goku_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (input?.conversationId) {
    query = query.eq("conversation_id", safeConversationId(input.conversationId))
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as GokuReportRow[]
}

export async function getGokuReport(reportId: string) {
  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_goku_reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle()

  if (error) throw error
  return (data as GokuReportRow | null) ?? null
}

export async function approveGokuSuggestion(input: {
  reportId: string
  suggestionId: string
}) {
  const report = await getGokuReport(input.reportId)
  if (!report) throw new Error("Report not found")

  const suggestions = [...report.suggestions]
  const index = suggestions.findIndex((item) => item.id === input.suggestionId)
  if (index < 0) throw new Error("Suggestion not found")

  const suggestion = suggestions[index]
  if (suggestion.status === "applied" && suggestion.applied_rule_id) {
    return {
      ok: true,
      already_applied: true,
      rule_id: suggestion.applied_rule_id,
    }
  }

  if (suggestion.type !== "learned_rule") {
    throw new Error("Only learned_rule suggestions can be approved into runtime rules")
  }

  const transcript = await loadFullConversationTranscript(report.conversation_id)
  const lastUserText =
    [...transcript].reverse().find((turn) => turn.role === "user")?.content ?? null

  const ruleId = await applyLearnedSuggestion(
    report.id,
    suggestion,
    lastUserText ?? undefined
  )

  if (!ruleId) {
    throw new Error("Suggestion failed validation — cannot apply as learned rule")
  }

  suggestions[index] = {
    ...suggestion,
    status: "applied",
    applied_rule_id: ruleId,
  }

  const appliedRuleIds = Array.from(
    new Set([...(report.applied_rule_ids ?? []), ruleId])
  )

  const supabase = getAgentSupabase()
  const { error } = await supabase
    .from("hom_agent_goku_reports")
    .update({
      suggestions,
      applied_rule_ids: appliedRuleIds,
    })
    .eq("id", report.id)

  if (error) throw error

  return { ok: true, rule_id: ruleId, report_id: report.id }
}

export async function findConversationsNeedingGoku(limit = SWEEP_BATCH_SIZE) {
  const supabase = getAgentSupabase()
  const { data: closedSessions, error } = await supabase
    .from("hom_agent_sessions")
    .select("conversation_id, inactivity_closed_at, reset_at")
    .not("inactivity_closed_at", "is", null)
    .order("inactivity_closed_at", { ascending: false })
    .limit(limit * 4)

  if (error) throw error
  if (!closedSessions?.length) return []

  const conversationIds = closedSessions
    .map((row) => asText(row.conversation_id))
    .filter(Boolean)

  const { data: existing, error: existingError } = await supabase
    .from("hom_agent_goku_reports")
    .select("conversation_id")
    .in("conversation_id", conversationIds)

  if (existingError) {
    if (existingError.code === "42P01") {
      return conversationIds.slice(0, limit).map((id) => ({
        conversation_id: id,
        close_reason: "inactivity_close" as const,
      }))
    }
    throw existingError
  }

  const reported = new Set((existing ?? []).map((row) => asText(row.conversation_id)))
  return closedSessions
    .map((row) => ({
      conversation_id: asText(row.conversation_id),
      close_reason: "inactivity_close" as GokuCloseReason,
    }))
    .filter((row) => row.conversation_id && !reported.has(row.conversation_id))
    .slice(0, limit)
}

export async function runGokuTrainerSweep(limit = SWEEP_BATCH_SIZE) {
  if (!isGokuTrainerEnabled()) {
    return { ok: true, skipped: "disabled" as const, processed: 0 }
  }

  const candidates = await findConversationsNeedingGoku(limit)
  const results = []

  for (const candidate of candidates) {
    try {
      const outcome = await runGokuTrainer(
        candidate.conversation_id,
        candidate.close_reason
      )
      results.push({ conversation_id: candidate.conversation_id, ...outcome })
    } catch (error) {
      results.push({
        conversation_id: candidate.conversation_id,
        ok: false,
        error: error instanceof Error ? error.message : "goku_failed",
      })
    }
  }

  return {
    ok: true,
    processed: results.length,
    results,
  }
}
