import type { QaAutomationRunRow } from "@/lib/agents/qa-automation-log"

export function qaRunProblem(run: QaAutomationRunRow) {
  if (run.root_cause?.trim()) return run.root_cause.trim()
  if (run.trigger === "human_assign") {
    return "הלקוח/ה הועבר/ה לנציג — נדרש אימות אם זו העברה תקינה או כשל."
  }
  if (run.trigger === "bot_failure") {
    return "הבוט שלח never-stuck במקום להמשיך את הזרימה."
  }
  return "—"
}

export function qaRunSolution(run: QaAutomationRunRow) {
  if (run.operator_notes?.trim() && !run.operator_notes.startsWith("HTTP")) {
    return run.operator_notes.trim()
  }
  if (run.fix_plan[0]?.trim()) return run.fix_plan[0].trim()
  if (run.outcome === "implemented" && run.commit_sha) {
    return `תוקן בקומיט ${run.commit_sha.slice(0, 7)}`
  }
  if (run.outcome === "false_alarm" || run.outcome === "ignored") {
    return "אין תיקון — אזעקת שווא / התנהגות תקינה."
  }
  if (run.outcome === "too_risky") {
    return "ממתין לאישור מפעיל לפני שינוי."
  }
  if (run.outcome === "triggered" || run.outcome === "webhook_failed") {
    return "בתהליך review — טרם הוחלט."
  }
  return "—"
}

export function qaRunRiskLabel(run: QaAutomationRunRow) {
  if (run.risk_score == null) return "—"
  if (run.risk_score >= 8) return `${run.risk_score}/10 — מסוכן מדי`
  if (run.risk_score >= 5) return `${run.risk_score}/10 — בינוני`
  return `${run.risk_score}/10 — נמוך`
}

export function qaRunRiskScore(run: QaAutomationRunRow) {
  return run.risk_score
}
