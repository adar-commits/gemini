import { NextResponse } from "next/server"
import {
  insertQaAutomationRun,
  type InsertQaAutomationRunInput,
  type QaAutomationOutcome,
} from "@/lib/agents/qa-automation-log"
import { getAgentSupabase } from "@/lib/agents/supabase"
import { isCronAuthorized } from "@/lib/agents/cron-auth"
import { buildHomServiceConversationUrl } from "@/lib/landbot/cursor-automation-qa"
import {
  mergeQaStageTimestamps,
  parseQaStageTimestamps,
} from "@/lib/agents/qa-stage-timing"

/** Same stamps scripts/log-qa-run.ts writes, so curl-only automation runs move the gauge too. */
function autoStageTimestamps(input: InsertQaAutomationRunInput) {
  const now = new Date().toISOString()
  if (input.phase !== "analyze" || input.outcome === "triggered") return undefined
  if (input.outcome === "chained") {
    return { analyze_completed_at: now, chain_at: now, implement_started_at: now }
  }
  return { analyze_completed_at: now }
}

export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const sessionId = String(body.session_id ?? body.sessionId ?? "").trim()
  const input: InsertQaAutomationRunInput = {
    sessionId,
    landbotCustomerId:
      typeof body.landbot_customer_id === "string"
        ? body.landbot_customer_id
        : null,
    conversationUrl: String(
      body.conversation_url ??
        body.conversationUrl ??
        (sessionId ? buildHomServiceConversationUrl(sessionId) : "")
    ),
    trigger: String(body.trigger ?? ""),
    phase: body.phase === "implement" ? "implement" : "analyze",
    outcome: String(body.outcome ?? "no_action") as InsertQaAutomationRunInput["outcome"],
    verdict: typeof body.verdict === "string" ? body.verdict : null,
    confidence: typeof body.confidence === "string" ? body.confidence : null,
    riskScore:
      typeof body.risk_score === "number"
        ? body.risk_score
        : typeof body.riskScore === "number"
          ? body.riskScore
          : null,
    rootCause:
      typeof body.root_cause === "string"
        ? body.root_cause
        : typeof body.rootCause === "string"
          ? body.rootCause
          : null,
    fixLayer:
      typeof body.fix_layer === "string"
        ? body.fix_layer
        : typeof body.fixLayer === "string"
          ? body.fixLayer
          : null,
    fixPlan: Array.isArray(body.fix_plan)
      ? body.fix_plan.filter((item): item is string => typeof item === "string")
      : Array.isArray(body.fixPlan)
        ? body.fixPlan.filter((item): item is string => typeof item === "string")
        : [],
    operatorQuestions: Array.isArray(body.operator_questions)
      ? body.operator_questions.filter(
          (item): item is string => typeof item === "string"
        )
      : [],
    commitSha:
      typeof body.commit_sha === "string"
        ? body.commit_sha
        : typeof body.commitSha === "string"
          ? body.commitSha
          : null,
    changedFiles: Array.isArray(body.changed_files)
      ? body.changed_files.filter((item): item is string => typeof item === "string")
      : [],
    idempotencyKey:
      typeof body.idempotency_key === "string"
        ? body.idempotency_key
        : typeof body.idempotencyKey === "string"
          ? body.idempotencyKey
          : null,
    operatorNotes:
      typeof body.operator_notes === "string" ? body.operator_notes : null,
    stageTimestamps:
      body.stage_timestamps && typeof body.stage_timestamps === "object"
        ? parseQaStageTimestamps(body.stage_timestamps)
        : undefined,
  }

  if (!input.sessionId || !input.conversationUrl || !input.trigger) {
    return NextResponse.json({ error: "Missing session_id / conversation_url / trigger" }, { status: 400 })
  }

  const autoStages = autoStageTimestamps(input)
  if (autoStages) input.stageTimestamps = { ...autoStages, ...input.stageTimestamps }

  try {
    const row = await insertQaAutomationRun(input)
    if (input.phase === "implement" && input.outcome === "implemented") {
      const supabase = getAgentSupabase()
      const now = new Date().toISOString()
      const completedStages = mergeQaStageTimestamps(input.stageTimestamps ?? {}, {
        implement_completed_at: now,
      })
      const staleOutcomes: QaAutomationOutcome[] = [
        "chained",
        "real_failure",
        "webhook_failed",
        "triggered",
      ]
      const { data: sessionRows } = await supabase
        .from("hom_agent_qa_runs")
        .select("id, stage_timestamps")
        .eq("session_id", input.sessionId.trim())
      for (const sessionRow of sessionRows ?? []) {
        await supabase
          .from("hom_agent_qa_runs")
          .update({
            stage_timestamps: mergeQaStageTimestamps(
              parseQaStageTimestamps(sessionRow.stage_timestamps),
              completedStages
            ),
          })
          .eq("id", sessionRow.id)
      }
      await supabase
        .from("hom_agent_qa_runs")
        .update({
          outcome: "implemented",
          phase: "implement",
          commit_sha: input.commitSha?.trim() || row.commit_sha,
          changed_files: input.changedFiles?.length ? input.changedFiles : row.changed_files,
          updated_at: now,
          stage_timestamps: mergeQaStageTimestamps(row.stage_timestamps, completedStages),
          operator_notes: input.commitSha
            ? `יושם בקומיט ${input.commitSha.trim().slice(0, 7)}`
            : "יושם",
        })
        .eq("session_id", input.sessionId.trim())
        .in("outcome", staleOutcomes)
    }
    return NextResponse.json({ ok: true, id: row.id })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Insert failed" },
      { status: 500 }
    )
  }
}
