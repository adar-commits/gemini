import type { CursorAutomationQaTrigger } from "@/lib/landbot/cursor-automation-qa"

export type QaAnalysisVerdict =
  | "false_alarm"
  | "real_failure"
  | "too_risky"
  | "ask_operator"
  | "already_covered"

export type QaFixLayer =
  | "prompt"
  | "hints"
  | "tool_guard"
  | "pre_turn"
  | "runtime"

export type QaAnalysis = {
  session_id: string
  conversation_url: string
  trigger: CursorAutomationQaTrigger
  verdict: QaAnalysisVerdict
  /** Implement only when high — medium/low → ask_operator instead. */
  confidence: "high" | "medium" | "low"
  root_cause: string
  fix_layer?: QaFixLayer
  fix_plan?: string[]
  operator_questions?: string[]
  duplicate_of_commit?: string | null
  risk_notes?: string
  analyzed_at?: string
}

const VERDICTS = new Set<QaAnalysisVerdict>([
  "false_alarm",
  "real_failure",
  "too_risky",
  "ask_operator",
  "already_covered",
])

const TRIGGERS = new Set<CursorAutomationQaTrigger>([
  "human_assign",
  "reset",
  "closed_unanswered",
  "bot_failure",
  "manual",
])

const FIX_LAYERS = new Set<QaFixLayer>([
  "prompt",
  "hints",
  "tool_guard",
  "pre_turn",
  "runtime",
])

export function parseQaAnalysis(raw: unknown): QaAnalysis | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const sessionId = typeof row.session_id === "string" ? row.session_id.trim() : ""
  const conversationUrl =
    typeof row.conversation_url === "string" ? row.conversation_url.trim() : ""
  const trigger = row.trigger
  const verdict = row.verdict
  const confidence = row.confidence
  const rootCause = typeof row.root_cause === "string" ? row.root_cause.trim() : ""

  if (!sessionId || !conversationUrl || !rootCause) return null
  if (typeof trigger !== "string" || !TRIGGERS.has(trigger as CursorAutomationQaTrigger)) {
    return null
  }
  if (typeof verdict !== "string" || !VERDICTS.has(verdict as QaAnalysisVerdict)) {
    return null
  }
  if (confidence !== "high" && confidence !== "medium" && confidence !== "low") {
    return null
  }

  const fixLayer =
    typeof row.fix_layer === "string" && FIX_LAYERS.has(row.fix_layer as QaFixLayer)
      ? (row.fix_layer as QaFixLayer)
      : undefined

  const fixPlan = Array.isArray(row.fix_plan)
    ? row.fix_plan.filter(
        (line): line is string =>
          typeof line === "string" && line.trim().length > 0
      )
    : undefined

  const operatorQuestions = Array.isArray(row.operator_questions)
    ? row.operator_questions.filter(
        (line): line is string =>
          typeof line === "string" && line.trim().length > 0
      )
    : undefined

  return {
    session_id: sessionId,
    conversation_url: conversationUrl,
    trigger: trigger as CursorAutomationQaTrigger,
    verdict: verdict as QaAnalysisVerdict,
    confidence,
    root_cause: rootCause,
    ...(fixLayer ? { fix_layer: fixLayer } : {}),
    ...(fixPlan?.length ? { fix_plan: fixPlan } : {}),
    ...(operatorQuestions?.length ? { operator_questions: operatorQuestions } : {}),
    ...(typeof row.duplicate_of_commit === "string"
      ? { duplicate_of_commit: row.duplicate_of_commit.trim() || null }
      : {}),
    ...(typeof row.risk_notes === "string" && row.risk_notes.trim()
      ? { risk_notes: row.risk_notes.trim() }
      : {}),
    ...(typeof row.analyzed_at === "string" ? { analyzed_at: row.analyzed_at } : {}),
  }
}

/** Analyze → implement gate inside the single self-improve automation. */
export function shouldImplementQaFix(analysis: QaAnalysis) {
  if (analysis.verdict !== "real_failure") return false
  if (analysis.confidence !== "high") return false
  if (!analysis.fix_layer) return false
  if (!analysis.fix_plan?.length) return false
  return true
}
