import type { QaAutomationRunRow } from "@/lib/agents/qa-automation-log"

export type QaEventStageId =
  | "sent"
  | "reading"
  | "analyzing"
  | "decision"
  | "coding"
  | "testing"
  | "shipped"

export type QaEventStageState =
  | "done"
  | "active"
  | "pending"
  | "failed"
  | "waiting"
  | "skipped"

export type QaEventStage = {
  id: QaEventStageId
  label: string
  state: QaEventStageState
  at: string | null
}

export type QaEventTone = "active" | "done" | "waiting" | "failed" | "closed"

export type QaEventProgress = {
  stages: QaEventStage[]
  /** 1-based stage the event is on now (for "4/7"). */
  position: number
  headline: string
  tone: QaEventTone
  percent: number
  /** In progress but no update for STALE_AFTER_MS. */
  stale: boolean
}

const STAGE_LABELS: Record<QaEventStageId, string> = {
  sent: "נשלח לאוטומציה",
  reading: "קריאת השיחה",
  analyzing: "ניתוח",
  decision: "החלטה",
  coding: "תיקון קוד",
  testing: "בדיקות ו-build",
  shipped: "נדחף ל-main",
}

const ACTIVE_HEADLINES: Record<QaEventStageId, string> = {
  sent: "נשלח — ממתין שהאוטומציה תתחיל",
  reading: "קורא את השיחה",
  analyzing: "מנתח מה השתבש",
  decision: "מחליט אם לתקן",
  coding: "מתקן קוד",
  testing: "מריץ guard + verify:deploy",
  shipped: "דוחף ל-main",
}

const ORDER: QaEventStageId[] = [
  "sent",
  "reading",
  "analyzing",
  "decision",
  "coding",
  "testing",
  "shipped",
]

const INSTANT_STAGES = new Set<QaEventStageId>(["sent", "decision", "shipped"])

const STALE_AFTER_MS = 10 * 60_000

const WAITING_OUTCOMES = new Set<QaAutomationRunRow["outcome"]>([
  "ask_operator",
  "too_risky",
  "real_failure",
])

/** Automation stopped and needs the operator (amber "decision" stage). */
export function isQaRunWaitingForOperator(run: Pick<QaAutomationRunRow, "outcome">) {
  return WAITING_OUTCOMES.has(run.outcome)
}

function parseMs(iso?: string | null) {
  if (!iso) return null
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : null
}

function stageTimes(run: QaAutomationRunRow): Record<QaEventStageId, string | null> {
  const ts = run.stage_timestamps
  return {
    sent: ts.event_at ?? run.created_at,
    reading: ts.reading_started_at ?? null,
    analyzing: ts.analyze_started_at ?? null,
    decision: ts.analyze_completed_at ?? null,
    coding: ts.implement_started_at ?? ts.chain_at ?? null,
    testing: ts.testing_started_at ?? null,
    shipped: ts.implement_completed_at ?? null,
  }
}

function furthestReached(run: QaAutomationRunRow, times: Record<QaEventStageId, string | null>) {
  const { outcome } = run
  // implement_completed_at is merged into every row of the session, so only the outcome counts here.
  if (outcome === "implemented" || outcome === "vanished") return 6
  if (times.testing) return 5
  if (
    times.coding ||
    outcome === "chained" ||
    outcome === "failed_guard" ||
    run.phase === "implement"
  ) {
    return 4
  }
  if (
    times.decision ||
    outcome === "real_failure" ||
    outcome === "ask_operator" ||
    outcome === "too_risky" ||
    outcome === "false_alarm" ||
    outcome === "already_covered" ||
    outcome === "ignored" ||
    outcome === "no_action"
  ) {
    return 3
  }
  if (times.analyzing) return 2
  if (times.reading) return 1
  return 0
}

function closedHeadline(outcome: QaAutomationRunRow["outcome"]) {
  switch (outcome) {
    case "false_alarm":
      return "אזעקת שווא — הבוט התנהג נכון"
    case "already_covered":
      return "כבר תוקן לאחרונה"
    case "ignored":
      return "סומן להתעלמות"
    default:
      return "הסתיים ללא תיקון"
  }
}

function waitingHeadline(outcome: QaAutomationRunRow["outcome"]) {
  switch (outcome) {
    case "ask_operator":
      return "ממתין לתשובה שלך"
    case "too_risky":
      return "מסוכן מדי — ממתין לאישורך"
    default:
      return "נמצאה תקלה — ממתין להחלטתך"
  }
}

export function qaEventProgress(run: QaAutomationRunRow, nowMs = Date.now()): QaEventProgress {
  const times = stageTimes(run)
  const reached = furthestReached(run, times)
  const { outcome } = run

  const states: QaEventStageState[] = ORDER.map(() => "pending")
  let headline: string
  let tone: QaEventTone
  let position: number

  if (outcome === "implemented" || outcome === "vanished") {
    states.fill("done")
    position = 7
    tone = outcome === "vanished" ? "closed" : "done"
    headline = outcome === "vanished" ? "התיקון בוטל (revert)" : "התיקון באוויר"
  } else if (outcome === "webhook_failed") {
    const failedAt = reached
    for (let i = 0; i < failedAt; i += 1) states[i] = "done"
    states[failedAt] = "failed"
    position = failedAt + 1
    tone = "failed"
    headline = failedAt === 0 ? "השליחה לאוטומציה נכשלה — לחץ ↻" : "האוטומציה נכשלה — לחץ ↻"
  } else if (outcome === "failed_guard") {
    const failedAt = Math.max(reached, 4)
    for (let i = 0; i < failedAt; i += 1) states[i] = "done"
    states[failedAt] = "failed"
    position = failedAt + 1
    tone = "failed"
    headline = "הבדיקות נכשלו — לא נדחף"
  } else if (isQaRunWaitingForOperator(run)) {
    for (let i = 0; i < 3; i += 1) states[i] = "done"
    states[3] = "waiting"
    position = 4
    tone = "waiting"
    headline = waitingHeadline(outcome)
  } else if (
    outcome === "false_alarm" ||
    outcome === "already_covered" ||
    outcome === "ignored" ||
    outcome === "no_action"
  ) {
    for (let i = 0; i < 4; i += 1) states[i] = "done"
    for (let i = 4; i < ORDER.length; i += 1) states[i] = "skipped"
    position = 4
    tone = "closed"
    headline = closedHeadline(outcome)
  } else {
    const activeIndex = INSTANT_STAGES.has(ORDER[reached]!) && reached < 6 ? reached + 1 : reached
    for (let i = 0; i < activeIndex; i += 1) states[i] = "done"
    states[activeIndex] = "active"
    position = activeIndex + 1
    tone = "active"
    headline =
      activeIndex === 1 && !times.reading
        ? ACTIVE_HEADLINES.sent
        : ACTIVE_HEADLINES[ORDER[activeIndex]!]
  }

  const doneCount = states.filter((state) => state === "done" || state === "skipped").length
  const activeCount = states.filter((state) => state === "active").length
  const lastUpdateMs = parseMs(run.updated_at) ?? parseMs(run.created_at) ?? nowMs

  return {
    stages: ORDER.map((id, index) => ({
      id,
      label: STAGE_LABELS[id],
      state: states[index]!,
      at: times[id],
    })),
    position,
    headline,
    tone,
    percent: Math.round(((doneCount + activeCount * 0.5) / ORDER.length) * 100),
    stale: tone === "active" && nowMs - lastUpdateMs > STALE_AFTER_MS,
  }
}
