"use client"

import { QaHealthGauge } from "@/components/qa/qa-health-gauge"
import { QaStageAverages } from "@/components/qa/qa-stage-averages"
import { qaHealthScore, qaHealthSegments } from "@/lib/agents/qa-run-display"
import type { QaStageTimingSegment } from "@/lib/agents/qa-stage-timing"
import { qaStageAverageMs } from "@/lib/agents/qa-stage-timing"

export function QaDashboardHero({
  stats,
  stageTimelines = [],
}: {
  stats: {
    days: number
    total: number
    inReview: number
    dismissed: number
    implemented: number
    tooRisky: number
  }
  stageTimelines?: QaStageTimingSegment[][]
}) {
  const score = qaHealthScore(stats)
  const segments = qaHealthSegments(stats)
  const averages = qaStageAverageMs(stageTimelines)

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-bl from-indigo-950 via-slate-900 to-violet-950 p-6 shadow-2xl ring-1 ring-white/10 lg:p-8">
      <div className="qa-aurora pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300/80">
            HoM · בקרת איכות
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white lg:text-4xl">
            QA Automation
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-indigo-100/75">
            אוטומציה אחת: QA → ניתוח → בריף → יישום. מעקב חי אחרי זמן המתנה, צינור התיקון,
            וציון סיכון — auto-fix אלא אם מסוכן מדי (8+).
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {segments.map((segment) => (
              <span
                key={segment.key}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white/90 ring-1 ring-white/10"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: segment.color }}
                />
                {segment.label}: {segment.value}
              </span>
            ))}
          </div>
          {stageTimelines.length ? (
            <div className="pt-3">
              <QaStageAverages averages={averages} />
            </div>
          ) : null}
        </div>
        <QaHealthGauge score={score} segments={segments} total={stats.total} />
      </div>
    </section>
  )
}
