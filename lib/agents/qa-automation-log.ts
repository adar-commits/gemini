import { getAgentSupabase } from "@/lib/agents/supabase"
import {
  mergeQaStageTimestamps,
  parseQaStageTimestamps,
  type QaStageTimestamps,
} from "@/lib/agents/qa-stage-timing"

export type QaAutomationPhase = "analyze" | "implement"

export type QaAutomationOutcome =
  | "triggered"
  | "webhook_failed"
  | "false_alarm"
  | "real_failure"
  | "ask_operator"
  | "too_risky"
  | "already_covered"
  | "chained"
  | "implemented"
  | "ignored"
  | "no_action"
  | "failed_guard"
  | "vanished"

export type QaOperatorReply = {
  at: string
  text: string
}

function parseOperatorReplies(raw: unknown): QaOperatorReply[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as Record<string, unknown>
    return typeof row.text === "string" && typeof row.at === "string"
      ? [{ at: row.at, text: row.text }]
      : []
  })
}

export type QaAutomationRunRow = {
  id: string
  session_id: string
  landbot_customer_id: string | null
  conversation_url: string
  trigger: string
  phase: QaAutomationPhase
  outcome: QaAutomationOutcome
  verdict: string | null
  confidence: string | null
  risk_score: number | null
  root_cause: string | null
  fix_layer: string | null
  fix_plan: string[]
  operator_questions: string[]
  commit_sha: string | null
  changed_files: string[]
  idempotency_key: string | null
  operator_notes: string | null
  /** Notes the operator typed on the manual trigger — never overwritten by automation logs. */
  operator_input: string | null
  /** Operator answers to a waiting event, oldest first. */
  operator_replies: QaOperatorReply[]
  stage_timestamps: QaStageTimestamps
  created_at: string
  updated_at: string
}

export type InsertQaAutomationRunInput = {
  sessionId: string
  landbotCustomerId?: string | null
  conversationUrl: string
  trigger: string
  phase: QaAutomationPhase
  outcome: QaAutomationOutcome
  verdict?: string | null
  confidence?: string | null
  riskScore?: number | null
  rootCause?: string | null
  fixLayer?: string | null
  fixPlan?: string[]
  operatorQuestions?: string[]
  commitSha?: string | null
  changedFiles?: string[]
  idempotencyKey?: string | null
  operatorNotes?: string | null
  operatorInput?: string | null
  stageTimestamps?: QaStageTimestamps
  createdAt?: string
}

const PLACEHOLDER_OUTCOMES = new Set<QaAutomationOutcome>([
  "triggered",
  "webhook_failed",
])

function shouldReplaceQaOutcome(
  existing: QaAutomationOutcome,
  incoming: QaAutomationOutcome
) {
  if (existing === incoming) return true
  if (PLACEHOLDER_OUTCOMES.has(existing)) return true
  if (incoming === "implemented") return true
  if (incoming === "vanished") return true
  if (existing === "chained" && incoming !== "triggered" && incoming !== "webhook_failed") {
    return true
  }
  return false
}

function mapRow(raw: Record<string, unknown>): QaAutomationRunRow {
  return {
    id: String(raw.id),
    session_id: String(raw.session_id),
    landbot_customer_id:
      typeof raw.landbot_customer_id === "string" ? raw.landbot_customer_id : null,
    conversation_url: String(raw.conversation_url),
    trigger: String(raw.trigger),
    phase: raw.phase as QaAutomationPhase,
    outcome: raw.outcome as QaAutomationOutcome,
    verdict: typeof raw.verdict === "string" ? raw.verdict : null,
    confidence: typeof raw.confidence === "string" ? raw.confidence : null,
    risk_score:
      typeof raw.risk_score === "number"
        ? raw.risk_score
        : raw.risk_score != null
          ? Number(raw.risk_score)
          : null,
    root_cause: typeof raw.root_cause === "string" ? raw.root_cause : null,
    fix_layer: typeof raw.fix_layer === "string" ? raw.fix_layer : null,
    fix_plan: Array.isArray(raw.fix_plan)
      ? raw.fix_plan.filter((item): item is string => typeof item === "string")
      : [],
    operator_questions: Array.isArray(raw.operator_questions)
      ? raw.operator_questions.filter(
          (item): item is string => typeof item === "string"
        )
      : [],
    commit_sha: typeof raw.commit_sha === "string" ? raw.commit_sha : null,
    changed_files: Array.isArray(raw.changed_files)
      ? raw.changed_files.filter((item): item is string => typeof item === "string")
      : [],
    idempotency_key:
      typeof raw.idempotency_key === "string" ? raw.idempotency_key : null,
    operator_notes:
      typeof raw.operator_notes === "string" ? raw.operator_notes : null,
    operator_input:
      typeof raw.operator_input === "string" ? raw.operator_input : null,
    operator_replies: parseOperatorReplies(raw.operator_replies),
    stage_timestamps: parseQaStageTimestamps(raw.stage_timestamps),
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
  }
}

export async function insertQaAutomationRun(input: InsertQaAutomationRunInput) {
  const supabase = getAgentSupabase()
  const now = new Date().toISOString()
  const payload: Record<string, unknown> = {
    session_id: input.sessionId.trim(),
    landbot_customer_id: input.landbotCustomerId?.trim() || null,
    conversation_url: input.conversationUrl.trim(),
    trigger: input.trigger.trim(),
    phase: input.phase,
    outcome: input.outcome,
    verdict: input.verdict?.trim() || null,
    confidence: input.confidence?.trim() || null,
    risk_score: input.riskScore ?? null,
    root_cause: input.rootCause?.trim() || null,
    fix_layer: input.fixLayer?.trim() || null,
    fix_plan: input.fixPlan ?? [],
    operator_questions: input.operatorQuestions ?? [],
    commit_sha: input.commitSha?.trim() || null,
    changed_files: input.changedFiles ?? [],
    idempotency_key: input.idempotencyKey?.trim() || null,
    operator_notes: input.operatorNotes?.trim() || null,
    stage_timestamps: input.stageTimestamps ?? {},
    updated_at: now,
  }
  if (input.operatorInput?.trim()) payload.operator_input = input.operatorInput.trim()
  if (input.createdAt) payload.created_at = input.createdAt

  const { data, error } = await supabase
    .from("hom_agent_qa_runs")
    .insert(payload)
    .select("*")
    .single()

  if (error) {
    if (error.code === "42P01") {
      throw new Error("hom_agent_qa_runs table missing — run Supabase migration")
    }
    if (error.code === "23505" && input.idempotencyKey) {
      const { data: existing, error: readError } = await supabase
        .from("hom_agent_qa_runs")
        .select("*")
        .eq("idempotency_key", input.idempotencyKey)
        .maybeSingle()
      if (readError) throw readError
      if (existing) {
        const existingOutcome = existing.outcome as QaAutomationOutcome
        if (!shouldReplaceQaOutcome(existingOutcome, input.outcome)) {
          return mapRow(existing as Record<string, unknown>)
        }
        const patch: Record<string, unknown> = { updated_at: now }
        if (input.outcome) patch.outcome = input.outcome
        if (input.phase) patch.phase = input.phase
        if (input.verdict?.trim()) patch.verdict = input.verdict.trim()
        if (input.confidence?.trim()) patch.confidence = input.confidence.trim()
        if (input.riskScore != null) patch.risk_score = input.riskScore
        if (input.rootCause?.trim()) patch.root_cause = input.rootCause.trim()
        if (input.fixLayer?.trim()) patch.fix_layer = input.fixLayer.trim()
        if (input.fixPlan?.length) patch.fix_plan = input.fixPlan
        if (input.operatorQuestions?.length) {
          patch.operator_questions = input.operatorQuestions
        }
        if (input.commitSha?.trim()) patch.commit_sha = input.commitSha.trim()
        if (input.changedFiles?.length) patch.changed_files = input.changedFiles
        if (input.operatorNotes !== undefined) {
          patch.operator_notes = input.operatorNotes?.trim() || null
        }
        if (input.stageTimestamps) {
          patch.stage_timestamps = mergeQaStageTimestamps(
            parseQaStageTimestamps(existing.stage_timestamps),
            input.stageTimestamps
          )
        }
        const { data: updated, error: updateError } = await supabase
          .from("hom_agent_qa_runs")
          .update(patch)
          .eq("id", existing.id)
          .select("*")
          .single()
        if (updateError) throw updateError
        return mapRow(updated as Record<string, unknown>)
      }
    }
    throw error
  }

  return mapRow(data as Record<string, unknown>)
}

export type QaDashboardBucket =
  | "all"
  | "in_review"
  | "dismissed"
  | "implemented"
  | "too_risky"

function qaDashboardSince(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString()
}

const QA_BUCKET_OUTCOMES: Record<
  Exclude<QaDashboardBucket, "all">,
  QaAutomationOutcome[]
> = {
  in_review: [
    "triggered",
    "webhook_failed",
    "chained",
    "real_failure",
    "ask_operator",
  ],
  dismissed: ["false_alarm", "ignored"],
  implemented: ["implemented"],
  too_risky: ["too_risky"],
}

export async function listQaAutomationRuns(input?: {
  limit?: number
  offset?: number
  outcome?: string
  bucket?: QaDashboardBucket
  phase?: QaAutomationPhase
  days?: number
}) {
  const supabase = getAgentSupabase()
  const limit = Math.min(Math.max(input?.limit ?? 50, 1), 200)
  const offset = Math.max(input?.offset ?? 0, 0)
  const days = input?.days ?? 30

  let query = supabase
    .from("hom_agent_qa_runs")
    .select("*", { count: "exact" })
    .gte("created_at", qaDashboardSince(days))
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (input?.outcome) query = query.eq("outcome", input.outcome)
  if (input?.bucket && input.bucket !== "all") {
    query = query.in("outcome", QA_BUCKET_OUTCOMES[input.bucket])
  }
  if (input?.phase) query = query.eq("phase", input.phase)

  const { data, error, count } = await query
  if (error) throw error

  return {
    runs: (data ?? []).map((row) => mapRow(row as Record<string, unknown>)),
    total: count ?? 0,
  }
}

export async function listQaRunsBySessionIds(sessionIds: string[]) {
  const unique = [...new Set(sessionIds.map((id) => id.trim()).filter(Boolean))]
  if (!unique.length) return new Map<string, QaAutomationRunRow[]>()

  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_qa_runs")
    .select("*")
    .in("session_id", unique)
    .order("created_at", { ascending: true })

  if (error) throw error

  const map = new Map<string, QaAutomationRunRow[]>()
  for (const row of data ?? []) {
    const mapped = mapRow(row as Record<string, unknown>)
    const list = map.get(mapped.session_id) ?? []
    list.push(mapped)
    map.set(mapped.session_id, list)
  }
  return map
}

export async function getQaAutomationStats(days = 7) {
  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_qa_runs")
    .select("outcome, phase, risk_score")
    .gte("created_at", qaDashboardSince(days))

  if (error) throw error

  const rows = data ?? []
  const inReview = rows.filter((row) =>
    QA_BUCKET_OUTCOMES.in_review.includes(row.outcome as QaAutomationOutcome)
  ).length
  const dismissed = rows.filter((row) =>
    QA_BUCKET_OUTCOMES.dismissed.includes(row.outcome as QaAutomationOutcome)
  ).length
  const implemented = rows.filter((row) => row.outcome === "implemented").length
  const tooRisky = rows.filter((row) => row.outcome === "too_risky").length

  return {
    days,
    total: rows.length,
    inReview,
    dismissed,
    implemented,
    tooRisky,
  }
}

export async function getQaAutomationRunByIdempotencyKey(idempotencyKey: string) {
  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_qa_runs")
    .select("*")
    .eq("idempotency_key", idempotencyKey.trim())
    .maybeSingle()
  if (error) throw error
  return data ? mapRow(data as Record<string, unknown>) : null
}

export async function getQaAutomationRunById(id: string) {
  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_qa_runs")
    .select("*")
    .eq("id", id.trim())
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function updateQaAutomationRun(input: {
  id: string
  phase?: QaAutomationPhase
  outcome?: QaAutomationOutcome
  operatorNotes?: string
  riskScore?: number
  /** Replaces (not merges) stage timestamps — used when a retry restarts the event. */
  stageTimestamps?: QaStageTimestamps
  operatorReplies?: QaOperatorReply[]
}) {
  const supabase = getAgentSupabase()
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (input.phase) patch.phase = input.phase
  if (input.outcome) patch.outcome = input.outcome
  if (input.operatorNotes !== undefined) patch.operator_notes = input.operatorNotes
  if (input.riskScore !== undefined) patch.risk_score = input.riskScore
  if (input.stageTimestamps) patch.stage_timestamps = input.stageTimestamps
  if (input.operatorReplies) patch.operator_replies = input.operatorReplies

  const { data, error } = await supabase
    .from("hom_agent_qa_runs")
    .update(patch)
    .eq("id", input.id)
    .select("*")
    .single()

  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export type QaReportedStage = "reading" | "analyzing" | "coding" | "testing"

export const QA_REPORTED_STAGES: QaReportedStage[] = [
  "reading",
  "analyzing",
  "coding",
  "testing",
]

function reportedStageKey(stage: QaReportedStage): keyof QaStageTimestamps {
  switch (stage) {
    case "reading":
      return "reading_started_at"
    case "analyzing":
      return "analyze_started_at"
    case "coding":
      return "implement_started_at"
    case "testing":
      return "testing_started_at"
    default: {
      const exhaustive: never = stage
      return exhaustive
    }
  }
}

/** Automation progress ping — stamps the event row found by idempotency key (else latest row for the session). */
export async function markQaRunStage(input: {
  stage: QaReportedStage
  idempotencyKey?: string | null
  sessionId?: string | null
}) {
  const supabase = getAgentSupabase()
  let existing: Record<string, unknown> | null = null

  if (input.idempotencyKey?.trim()) {
    const { data, error } = await supabase
      .from("hom_agent_qa_runs")
      .select("*")
      .eq("idempotency_key", input.idempotencyKey.trim())
      .maybeSingle()
    if (error) throw error
    existing = data
  }
  if (!existing && input.sessionId?.trim()) {
    const { data, error } = await supabase
      .from("hom_agent_qa_runs")
      .select("*")
      .eq("session_id", input.sessionId.trim())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    existing = data
  }
  if (!existing) return null

  const now = new Date().toISOString()
  const key = reportedStageKey(input.stage)
  const current = parseQaStageTimestamps(existing.stage_timestamps)
  const { data, error } = await supabase
    .from("hom_agent_qa_runs")
    .update({
      stage_timestamps: mergeQaStageTimestamps(current, { [key]: current[key] ?? now }),
      updated_at: now,
    })
    .eq("id", existing.id as string)
    .select("*")
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function deleteQaAutomationRun(id: string) {
  const supabase = getAgentSupabase()
  const { error } = await supabase.from("hom_agent_qa_runs").delete().eq("id", id.trim())
  if (error) throw error
}

export async function markQaRunVanishedByCommitSha(commitSha: string) {
  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_qa_runs")
    .update({
      outcome: "vanished",
      updated_at: new Date().toISOString(),
      operator_notes: "Reverted via qa:vanish",
    })
    .eq("commit_sha", commitSha.trim())
    .select("*")

  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}
