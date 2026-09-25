import type { QaAutomationOutcome, QaAutomationRunRow } from "@/lib/agents/qa-automation-log"
import { formatQaElapsedHebrew, isQaRunActive, qaRunElapsedMs } from "@/lib/agents/qa-run-display"

export type QaStageTimestamps = {
  event_at?: string
  reading_started_at?: string
  analyze_started_at?: string
  analyze_completed_at?: string
  chain_at?: string
  implement_started_at?: string
  testing_started_at?: string
  implement_completed_at?: string
}

export type QaStageTimingId = "event" | "analyze" | "coding" | "completed"

export type QaStageTimingSegment = {
  id: QaStageTimingId
  label: string
  status: "done" | "active" | "pending" | "failed"
  durationMs: number | null
  startedAt: string | null
  endedAt: string | null
}

const ANALYZE_DONE_OUTCOMES = new Set<QaAutomationOutcome>([
  "real_failure",
  "false_alarm",
  "ask_operator",
  "too_risky",
  "already_covered",
  "chained",
  "implemented",
  "ignored",
  "no_action",
])

function parseIsoMs(iso?: string | null) {
  if (!iso?.trim()) return null
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : null
}

function durationBetween(start?: string | null, end?: string | null, nowMs?: number) {
  const startMs = parseIsoMs(start)
  if (startMs == null) return null
  const endMs = parseIsoMs(end) ?? nowMs ?? Date.now()
  return Math.max(0, endMs - startMs)
}

export function parseQaStageTimestamps(raw: unknown): QaStageTimestamps {
  if (!raw || typeof raw !== "object") return {}
  const row = raw as Record<string, unknown>
  const pick = (key: keyof QaStageTimestamps) =>
    typeof row[key] === "string" ? row[key]!.trim() : undefined
  return {
    event_at: pick("event_at"),
    reading_started_at: pick("reading_started_at"),
    analyze_started_at: pick("analyze_started_at"),
    analyze_completed_at: pick("analyze_completed_at"),
    chain_at: pick("chain_at"),
    implement_started_at: pick("implement_started_at"),
    testing_started_at: pick("testing_started_at"),
    implement_completed_at: pick("implement_completed_at"),
  }
}

export function mergeQaStageTimestamps(
  base: QaStageTimestamps,
  patch: QaStageTimestamps
): QaStageTimestamps {
  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(patch).filter(([, value]) => typeof value === "string" && value.trim())
    ),
  }
}

/** Infer missing timestamps from sibling rows (retries) and created/updated fields. */
export function resolveQaStageTimestamps(
  run: QaAutomationRunRow,
  siblings: QaAutomationRunRow[] = []
): QaStageTimestamps {
  const rows = [...siblings, run].sort(
    (a, b) => parseIsoMs(a.created_at)! - parseIsoMs(b.created_at)!
  )

  let merged: QaStageTimestamps = {}
  for (const row of rows) {
    merged = mergeQaStageTimestamps(merged, parseQaStageTimestamps(row.stage_timestamps))
  }

  const first = rows[0]
  const event_at = merged.event_at ?? first?.created_at ?? run.created_at
  const analyze_started_at =
    merged.analyze_started_at ?? merged.event_at ?? first?.created_at ?? run.created_at

  let analyze_completed_at = merged.analyze_completed_at
  if (!analyze_completed_at) {
    for (const row of rows) {
      if (
        row.phase === "analyze" &&
        ANALYZE_DONE_OUTCOMES.has(row.outcome) &&
        row.outcome !== "chained"
      ) {
        analyze_completed_at = row.updated_at
        break
      }
    }
    for (const row of rows) {
      if (row.outcome === "chained") {
        analyze_completed_at = analyze_completed_at ?? row.updated_at
        break
      }
    }
  }

  const chain_at =
    merged.chain_at ??
    rows.find((row) => row.outcome === "chained")?.updated_at ??
    undefined

  const chainSucceeded =
    Boolean(chain_at) ||
    rows.some(
      (row) => row.outcome === "chained" || row.outcome === "implemented"
    )

  const implement_started_at =
    merged.implement_started_at ??
    chain_at ??
    (chainSucceeded ? merged.analyze_completed_at : undefined)

  let implement_completed_at = merged.implement_completed_at
  if (!implement_completed_at) {
    const done = rows.find((row) => row.outcome === "implemented")
    implement_completed_at = done?.updated_at ?? run.updated_at
    if (run.outcome !== "implemented" && run.outcome !== "vanished") {
      implement_completed_at = merged.implement_completed_at
    }
  }

  return mergeQaStageTimestamps(merged, {
    event_at,
    analyze_started_at,
    analyze_completed_at,
    chain_at,
    implement_started_at,
    implement_completed_at,
  })
}

export function buildQaStageTimeline(
  run: QaAutomationRunRow,
  siblings: QaAutomationRunRow[] = [],
  nowMs = Date.now()
): QaStageTimingSegment[] {
  const ts = resolveQaStageTimestamps(run, siblings)
  const active = isQaRunActive(run.outcome)
  const clockMs = active ? nowMs : parseIsoMs(run.updated_at) ?? nowMs
  const failed = run.outcome === "webhook_failed" || run.outcome === "failed_guard"
  const implemented = run.outcome === "implemented" || run.outcome === "vanished"
  const chained = run.outcome === "chained" || run.phase === "implement"
  const analyzing = run.outcome === "triggered"
  const analyzed =
    implemented ||
    chained ||
    run.outcome === "real_failure" ||
    run.outcome === "ask_operator" ||
    run.outcome === "too_risky" ||
    run.outcome === "already_covered" ||
    run.outcome === "false_alarm" ||
    run.outcome === "ignored" ||
    run.outcome === "no_action" ||
    failed
  const chainFailed = failed && analyzed && !chained && !implemented

  const analyzeEnd = ts.analyze_completed_at ?? ts.chain_at
  const codingEnd = implemented ? ts.implement_completed_at : chainFailed ? ts.analyze_completed_at ?? run.updated_at : null
  const totalEnd = implemented
    ? ts.implement_completed_at
    : chainFailed || failed
      ? ts.analyze_completed_at ?? run.updated_at
      : null

  const eventDuration = durationBetween(ts.event_at, ts.analyze_started_at, clockMs)
  const analyzeDuration = durationBetween(ts.analyze_started_at, analyzeEnd, clockMs)
  const codingDuration = durationBetween(ts.implement_started_at ?? ts.chain_at, codingEnd, clockMs)
  const totalDuration = durationBetween(ts.event_at, totalEnd, clockMs)

  return [
    {
      id: "event",
      label: "אירוע",
      status: failed && analyzing ? "failed" : ts.event_at ? "done" : "pending",
      durationMs: eventDuration,
      startedAt: ts.event_at ?? null,
      endedAt: ts.analyze_started_at ?? null,
    },
    {
      id: "analyze",
      label: "ניתוח QA",
      status: failed && !analyzeEnd ? "failed" : analyzing ? "active" : analyzeEnd ? "done" : "pending",
      durationMs: analyzeDuration,
      startedAt: ts.analyze_started_at ?? null,
      endedAt: analyzeEnd ?? null,
    },
    {
      id: "coding",
      label: "Coding",
      status:
        chainFailed || (failed && chained && !implemented)
          ? "failed"
          : chained && !implemented
            ? "active"
            : codingEnd
              ? "done"
              : "pending",
      durationMs: chainFailed ? null : codingDuration,
      startedAt: ts.implement_started_at ?? ts.chain_at ?? null,
      endedAt: codingEnd ?? null,
    },
    {
      id: "completed",
      label: "הושלם",
      status: implemented ? "done" : chainFailed || failed ? "failed" : chained ? "active" : "pending",
      durationMs: totalDuration,
      startedAt: ts.event_at ?? null,
      endedAt: totalEnd ?? null,
    },
  ]
}

export function formatStageDuration(ms: number | null) {
  if (ms == null) return "—"
  if (ms < 1000) return "<1 שנ׳"
  return formatQaElapsedHebrew(ms)
}

export function qaStageAverageMs(segments: QaStageTimingSegment[][]) {
  const sums: Record<QaStageTimingId, { total: number; count: number }> = {
    event: { total: 0, count: 0 },
    analyze: { total: 0, count: 0 },
    coding: { total: 0, count: 0 },
    completed: { total: 0, count: 0 },
  }

  for (const timeline of segments) {
    for (const segment of timeline) {
      if (segment.durationMs == null || segment.status === "pending") continue
      sums[segment.id].total += segment.durationMs
      sums[segment.id].count += 1
    }
  }

  return {
    event: sums.event.count ? Math.round(sums.event.total / sums.event.count) : null,
    analyze: sums.analyze.count ? Math.round(sums.analyze.total / sums.analyze.count) : null,
    coding: sums.coding.count ? Math.round(sums.coding.total / sums.coding.count) : null,
    completed: sums.completed.count ? Math.round(sums.completed.total / sums.completed.count) : null,
  }
}

export function qaRunTotalElapsedMs(run: QaAutomationRunRow, siblings: QaAutomationRunRow[] = [], nowMs = Date.now()) {
  const ts = resolveQaStageTimestamps(run, siblings)
  const start = ts.event_at ?? run.created_at
  if (isQaRunActive(run.outcome)) {
    return qaRunElapsedMs(start, nowMs)
  }

  const end =
    run.outcome === "implemented" || run.outcome === "vanished"
      ? ts.implement_completed_at ?? run.updated_at
      : ts.analyze_completed_at ?? run.updated_at ?? run.created_at
  const endMs = parseIsoMs(end) ?? nowMs
  return qaRunElapsedMs(start, endMs)
}
