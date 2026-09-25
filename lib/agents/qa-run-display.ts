import type { QaAutomationOutcome, QaAutomationRunRow } from "@/lib/agents/qa-automation-log"

export type QaPipelineStepId = "trigger" | "analyze" | "chain" | "implement"

export type QaPipelineStep = {
  id: QaPipelineStepId
  label: string
  state: "done" | "active" | "pending" | "failed"
}

const ACTIVE_OUTCOMES = new Set<QaAutomationOutcome>(["triggered", "chained"])

export function isQaRunActive(outcome: QaAutomationOutcome) {
  return ACTIVE_OUTCOMES.has(outcome)
}

export function qaRunElapsedMs(iso: string, nowMs = Date.now()) {
  const parsed = Date.parse(iso.trim())
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, nowMs - parsed)
}

export function formatQaElapsedHebrew(ms: number) {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return "פחות מדקה"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} דק׳`
  const hours = Math.floor(minutes / 60)
  const remMin = minutes % 60
  if (hours < 24) {
    return remMin > 0 ? `${hours} שע׳ ${remMin} דק׳` : `${hours} שע׳`
  }
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  return remHours > 0 ? `${days} ימים ${remHours} שע׳` : `${days} ימים`
}

export function qaRunElapsedLabel(run: QaAutomationRunRow) {
  const anchor = run.updated_at || run.created_at
  return formatQaElapsedHebrew(qaRunElapsedMs(anchor))
}

export function qaFixLayerLabel(layer: string | null) {
  switch (layer) {
    case "prompt":
      return "פרומпт (hom-bot)"
    case "hints":
      return "רמזי תור (hints)"
    case "tool_guard":
      return "Guard על כלי"
    case "pre_turn":
      return "Pre-turn"
    case "runtime":
      return "Runtime"
    default:
      return layer ?? "—"
  }
}

export function qaConfidenceLabel(confidence: string | null) {
  switch (confidence) {
    case "high":
      return "גבוהה"
    case "medium":
      return "בינונית"
    case "low":
      return "נמוכה"
    default:
      return confidence ?? "—"
  }
}

export function qaVerdictLabel(verdict: string | null) {
  switch (verdict) {
    case "real_failure":
      return "כשל אמיתי"
    case "false_alarm":
      return "אזעקת שווא"
    case "ask_operator":
      return "שאל את המפעיל"
    case "too_risky":
      return "מסוכן מדי"
    case "already_covered":
      return "כבר טופל"
    default:
      return verdict ?? "—"
  }
}

export function qaPipelineSteps(run: QaAutomationRunRow): QaPipelineStep[] {
  const { outcome, phase } = run
  const failed = outcome === "webhook_failed" || outcome === "failed_guard"
  const implemented = outcome === "implemented" || outcome === "vanished"
  const chained = outcome === "chained" || (phase === "implement" && !implemented)
  const analyzed =
    implemented ||
    chained ||
    outcome === "real_failure" ||
    outcome === "ask_operator" ||
    outcome === "too_risky" ||
    outcome === "already_covered" ||
    outcome === "false_alarm" ||
    outcome === "ignored" ||
    outcome === "no_action" ||
    failed

  const trigger: QaPipelineStep = {
    id: "trigger",
    label: "טריגר מ-production",
    state: "done",
  }

  let analyzeState: QaPipelineStep["state"] = "pending"
  if (failed && !analyzed) analyzeState = "failed"
  else if (outcome === "triggered") analyzeState = "active"
  else if (analyzed) analyzeState = "done"

  let chainState: QaPipelineStep["state"] = "pending"
  if (failed && analyzed && !chained && !implemented) chainState = "failed"
  else if (outcome === "chained" || (phase === "implement" && !implemented)) chainState = "active"
  else if (chained || implemented) chainState = "done"

  let implementState: QaPipelineStep["state"] = "pending"
  if (implemented) implementState = "done"
  else if (phase === "implement" && !implemented) implementState = "active"
  else if (failed && chained) implementState = "failed"

  return [
    trigger,
    { id: "analyze", label: "ניתוח", state: analyzeState },
    { id: "chain", label: "אישור תיקון", state: chainState },
    { id: "implement", label: "יישום + push", state: implementState },
  ]
}

export function qaPipelineProgress(steps: QaPipelineStep[]) {
  const weights = { done: 1, active: 0.55, pending: 0, failed: 0.35 }
  const total = steps.length
  const score = steps.reduce((sum, step) => sum + weights[step.state], 0)
  return Math.round((score / total) * 100)
}

export function qaHealthScore(stats: {
  total: number
  inReview: number
  implemented: number
  tooRisky: number
}) {
  const actionable = stats.implemented + stats.inReview + stats.tooRisky
  if (actionable <= 0) return stats.total > 0 ? 100 : 0
  return Math.round((stats.implemented / actionable) * 100)
}

export function qaHealthSegments(stats: {
  total: number
  inReview: number
  dismissed: number
  implemented: number
  tooRisky: number
}) {
  return [
    { key: "implemented", label: "יושם", value: stats.implemented, color: "#10b981" },
    { key: "in_review", label: "ב-review", value: stats.inReview, color: "#0ea5e9" },
    { key: "dismissed", label: "התעלמות", value: stats.dismissed, color: "#a1a1aa" },
    { key: "too_risky", label: "מסוכן", value: stats.tooRisky, color: "#f43f5e" },
  ].filter((segment) => segment.value > 0)
}
