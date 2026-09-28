import { getAgentSupabase } from "@/lib/agents/supabase"
import { shouldWaitForOperator } from "@/lib/agents/qa-autonomy-gate"
import {
  getQaAutomationRunById,
  type QaAutomationRunRow,
} from "@/lib/agents/qa-automation-log"
import { autoContinueObviousQaRun } from "@/lib/landbot/qa-run-retry"

const WAIT_OUTCOMES = ["ask_operator", "too_risky", "real_failure"] as const

function isObviousAutoContinue(run: QaAutomationRunRow) {
  return !shouldWaitForOperator({
    outcome: run.outcome,
    operatorQuestions: run.operator_questions,
    fixLayer: run.fix_layer,
    fixPlan: run.fix_plan,
    confidence: run.confidence,
    riskScore: run.risk_score,
  })
}

/** Unblock stale dashboard rows that should never have waited on the operator. */
export async function drainObviousQaOperatorWaits(limit = 20) {
  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_qa_runs")
    .select("*")
    .in("outcome", [...WAIT_OUTCOMES])
    .order("updated_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50))

  if (error) throw error

  let continued = 0
  let skipped = 0
  for (const raw of data ?? []) {
    const run = await getQaAutomationRunById(String(raw.id))
    if (!run) continue
    if (!isObviousAutoContinue(run)) {
      skipped += 1
      continue
    }
    const result = await autoContinueObviousQaRun(run)
    if (result.ok) continued += 1
  }

  return { continued, skipped, scanned: (data ?? []).length }
}
