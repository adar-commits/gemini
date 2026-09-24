import { NextResponse } from "next/server"
import {
  insertQaAutomationRun,
  type InsertQaAutomationRunInput,
  type QaAutomationOutcome,
} from "@/lib/agents/qa-automation-log"
import { getAgentSupabase } from "@/lib/agents/supabase"

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const header = request.headers.get("authorization")?.trim()
  return header === `Bearer ${secret}`
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const input: InsertQaAutomationRunInput = {
    sessionId: String(body.session_id ?? body.sessionId ?? ""),
    landbotCustomerId:
      typeof body.landbot_customer_id === "string"
        ? body.landbot_customer_id
        : null,
    conversationUrl: String(body.conversation_url ?? body.conversationUrl ?? ""),
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
  }

  if (!input.sessionId || !input.conversationUrl || !input.trigger) {
    return NextResponse.json({ error: "Missing session_id / conversation_url / trigger" }, { status: 400 })
  }

  try {
    const row = await insertQaAutomationRun(input)
    if (input.phase === "implement" && input.outcome === "implemented") {
      const supabase = getAgentSupabase()
      const staleOutcomes: QaAutomationOutcome[] = [
        "chained",
        "real_failure",
        "webhook_failed",
        "triggered",
      ]
      await supabase
        .from("hom_agent_qa_runs")
        .update({
          outcome: "implemented",
          phase: "implement",
          commit_sha: input.commitSha?.trim() || row.commit_sha,
          changed_files: input.changedFiles?.length ? input.changedFiles : row.changed_files,
          updated_at: new Date().toISOString(),
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
