"use client"

import type { QaStageTimingSegment } from "@/lib/agents/qa-stage-timing"
import { formatStageDuration } from "@/lib/agents/qa-stage-timing"

const statusStyles = {
  done: {
    bar: "bg-emerald-500",
    text: "text-emerald-800",
    badge: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  },
  active: {
    bar: "bg-sky-500 qa-progress-bar",
    text: "text-sky-800 font-semibold",
    badge: "bg-sky-100 text-sky-900 ring-sky-200",
  },
  pending: {
    bar: "bg-zinc-200",
    text: "text-zinc-400",
    badge: "bg-zinc-100 text-zinc-500 ring-zinc-200",
  },
  failed: {
    bar: "bg-rose-500",
    text: "text-rose-700 font-semibold",
    badge: "bg-rose-100 text-rose-800 ring-rose-200",
  },
} as const

export function QaStageTimeline({ segments }: { segments: QaStageTimingSegment[] }) {
  const knownDurations = segments
    .filter((segment) => segment.durationMs != null && segment.durationMs > 0)
    .map((segment) => segment.durationMs!)
  const totalKnown = knownDurations.reduce((sum, ms) => sum + ms, 0) || 1

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          זמן לפי שלב
        </p>
      </div>

      <div className="flex h-3 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-black/[0.04]">
        {segments.map((segment) => {
          const width =
            segment.durationMs != null && segment.durationMs > 0
              ? Math.max(8, Math.round((segment.durationMs / totalKnown) * 100))
              : segment.status === "active"
                ? 12
                : 4
          const style = statusStyles[segment.status]
          return (
            <div
              key={segment.id}
              className={`${style.bar} transition-all duration-700`}
              style={{ width: `${width}%` }}
              title={`${segment.label}: ${formatStageDuration(segment.durationMs)}`}
            />
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {segments.map((segment) => {
          const style = statusStyles[segment.status]
          return (
            <div
              key={segment.id}
              className={`rounded-xl px-2.5 py-2 ring-1 ${style.badge}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[11px] ${style.text}`}>{segment.label}</span>
                {segment.status === "active" ? (
                  <span className="qa-spinner h-3 w-3 rounded-full border-2 border-sky-500 border-t-transparent" />
                ) : null}
              </div>
              <p className="mt-0.5 text-sm font-bold tabular-nums">
                {formatStageDuration(segment.durationMs)}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
