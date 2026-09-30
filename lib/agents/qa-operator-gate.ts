import type { QaAutomationRunRow } from "@/lib/agents/qa-automation-log"

/** Operator answered every MCQ the automation asked on this event. */
export function operatorQuestionsAnswered(
  run: Pick<QaAutomationRunRow, "operator_questions" | "operator_replies">
) {
  const replies = run.operator_replies ?? []
  const questions = run.operator_questions ?? []
  if (replies.length === 0) return false
  if (questions.length === 0) return false
  return replies.length >= questions.length
}

export function buildOperatorContinuationNotes(
  run: Pick<
    QaAutomationRunRow,
    "operator_questions" | "operator_replies" | "fix_layer" | "fix_plan" | "verdict"
  >,
  baseNote: string
) {
  if (!operatorQuestionsAnswered(run)) return baseNote

  const lines = [
    baseNote,
    "",
    "OPERATOR GATE PASSED — operator_replies answer every operator_question.",
    "Do NOT ask the same questions again.",
    "Continue from previous_analysis. Log outcome chained and run step 4 Develop now.",
  ]

  if (run.fix_layer?.trim()) {
    lines.push(`fix_layer=${run.fix_layer} is approved — implement fix_plan as written.`)
  }
  if (run.verdict === "real_failure" || run.verdict === "too_risky") {
    lines.push("Operator answers count as explicit approval even when risk_score ≥ 8.")
  }

  return lines.join("\n")
}
