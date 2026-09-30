import {
  updateQaAutomationRun,
  type QaAutomationRunRow,
} from "@/lib/agents/qa-automation-log"
import { getAgentSupabase } from "@/lib/agents/supabase"
import { drainObviousQaOperatorWaits } from "@/lib/landbot/qa-auto-continue"

/** Analyze path budget in automation instructions is ~2 min — 15 min is a hard ceiling. */
export const QA_RUN_ANALYZE_TIMEOUT_MS = parseQaTimeoutMinutes(
  process.env.QA_AUTOMATION_ANALYZE_TIMEOUT_MINUTES,
  15
)

/** Implement path includes verify:deploy — allow longer, still bounded. */
export const QA_RUN_IMPLEMENT_TIMEOUT_MS = parseQaTimeoutMinutes(
  process.env.QA_AUTOMATION_IMPLEMENT_TIMEOUT_MINUTES,
  45
)

function parseQaTimeoutMinutes(raw: string | undefined, fallback: number) {
  const value = Number(raw?.trim())
  if (!Number.isFinite(value) || value <= 0) return fallback * 60_000
  return Math.min(Math.max(value, 5), 24 * 60) * 60_000
}

export function qaRunActiveTimeoutMs(
  run: Pick<QaAutomationRunRow, "outcome" | "phase">
): number | null {
  if (run.outcome === "triggered") return QA_RUN_ANALYZE_TIMEOUT_MS
  if (run.outcome === "chained" || run.phase === "implement") {
    return QA_RUN_IMPLEMENT_TIMEOUT_MS
  }
  return null
}

export function isQaRunPastActiveTimeout(
  run: Pick<QaAutomationRunRow, "outcome" | "phase" | "created_at" | "updated_at">,
  nowMs = Date.now()
) {
  const timeoutMs = qaRunActiveTimeoutMs(run)
  if (timeoutMs == null) return false
  const anchorMs = Date.parse(run.updated_at || run.created_at)
  if (!Number.isFinite(anchorMs)) return false
  return nowMs - anchorMs > timeoutMs
}

function timeoutNote(run: QaAutomationRunRow, timeoutMinutes: number) {
  if (run.outcome === "chained" || run.phase === "implement") {
    return `האוטומציה לא סיימה יישום תוך ${timeoutMinutes} דקות — נעצר כדי לא לבזבז tokens. לחץ ↻ לניסיון חדש.`
  }
  return `האוטומציה לא השיבה תוך ${timeoutMinutes} דקות — נעצר כדי לא לבזבז tokens. לחץ ↻ לניסיון חדש.`
}

/** Marks stuck triggered/chained rows as webhook_failed so the dashboard stops spinning. */
export async function expireStaleQaRuns(nowMs = Date.now()) {
  const supabase = getAgentSupabase()
  const analyzeCutoff = new Date(nowMs - QA_RUN_ANALYZE_TIMEOUT_MS).toISOString()
  const implementCutoff = new Date(nowMs - QA_RUN_IMPLEMENT_TIMEOUT_MS).toISOString()
  const analyzeMinutes = Math.round(QA_RUN_ANALYZE_TIMEOUT_MS / 60_000)
  const implementMinutes = Math.round(QA_RUN_IMPLEMENT_TIMEOUT_MS / 60_000)

  const { data: triggeredRows, error: triggeredError } = await supabase
    .from("hom_agent_qa_runs")
    .select("id, session_id, outcome, phase, created_at, updated_at")
    .eq("outcome", "triggered")
    .lt("updated_at", analyzeCutoff)

  if (triggeredError) throw triggeredError

  const { data: chainedRows, error: chainedError } = await supabase
    .from("hom_agent_qa_runs")
    .select("id, session_id, outcome, phase, created_at, updated_at")
    .eq("outcome", "chained")
    .lt("updated_at", implementCutoff)

  if (chainedError) throw chainedError

  const expired: string[] = []

  for (const row of [...(triggeredRows ?? []), ...(chainedRows ?? [])]) {
    const mapped = row as Pick<
      QaAutomationRunRow,
      "id" | "session_id" | "outcome" | "phase" | "created_at" | "updated_at"
    >
    if (!isQaRunPastActiveTimeout(mapped, nowMs)) continue

    const minutes =
      mapped.outcome === "chained" || mapped.phase === "implement"
        ? implementMinutes
        : analyzeMinutes

    await updateQaAutomationRun({
      id: mapped.id,
      outcome: "webhook_failed",
      operatorNotes: timeoutNote(mapped as QaAutomationRunRow, minutes),
    })
    expired.push(mapped.session_id)
  }

  if (expired.length) {
    console.info("[qa-run-expiry] expired stale automation runs", {
      count: expired.length,
      sessions: expired.slice(0, 10),
    })
  }

  let autoContinued = 0
  try {
    const drained = await drainObviousQaOperatorWaits(5)
    autoContinued = drained.continued
  } catch (drainError) {
    console.warn("[qa-run-expiry] auto-continue obvious waits failed", drainError)
  }

  return { expired: expired.length, sessionIds: expired, autoContinued }
}
