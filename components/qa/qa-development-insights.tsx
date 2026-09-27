"use client"

import { useMemo, useState } from "react"
import type {
  EnrichedDevelopmentInsight,
  MessageInsightSignals,
  QaInsightCategory,
  QaInsightPriority,
} from "@/lib/agents/qa-development-insights"
import {
  qaInsightCategoryLabel,
  qaInsightPriorityLabel,
} from "@/lib/agents/qa-development-insights"

const priorityTone: Record<QaInsightPriority, string> = {
  critical: "bg-rose-100 text-rose-900 ring-rose-300",
  high: "bg-orange-100 text-orange-900 ring-orange-300",
  medium: "bg-amber-100 text-amber-900 ring-amber-300",
  low: "bg-slate-100 text-slate-700 ring-slate-300",
}

const categoryTone: Record<QaInsightCategory, string> = {
  api: "text-violet-700 bg-violet-50 ring-violet-200",
  runtime: "text-sky-700 bg-sky-50 ring-sky-200",
  routing: "text-indigo-700 bg-indigo-50 ring-indigo-200",
  agent: "text-emerald-700 bg-emerald-50 ring-emerald-200",
  infra: "text-zinc-700 bg-zinc-50 ring-zinc-200",
}

function SignalPills({ signals }: { signals: MessageInsightSignals }) {
  const items = [
    { label: "RC בטקסט לקוח", value: signals.rcReceiptMentions },
    { label: "IN/OV", value: signals.invoiceDocMentions },
    { label: "#הזמנה", value: signals.hashOrderMentions },
    { label: "SO…", value: signals.soOrderMentions },
  ].filter((item) => item.value > 0)

  if (!items.length) return null

  return (
    <div className="flex flex-wrap gap-2 pt-2">
      <span className="text-[11px] text-slate-500">
        סкан {signals.userMessagesScanned} הודעות לקוח ({signals.scanDays} ימים):
      </span>
      {items.map((item) => (
        <span
          key={item.label}
          className="rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-black/[0.06]"
        >
          {item.label}: {item.value}
        </span>
      ))}
    </div>
  )
}

function InsightCard({ insight }: { insight: EnrichedDevelopmentInsight }) {
  const [open, setOpen] = useState(insight.priority === "critical" || insight.priority === "high")

  return (
    <article
      className="rounded-2xl bg-white ring-1 ring-black/[0.06] transition hover:shadow-md"
      id={`insight-${insight.id}`}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start gap-3 px-4 py-3 text-right"
      >
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${priorityTone[insight.priority]}`}
            >
              {qaInsightPriorityLabel(insight.priority)}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${categoryTone[insight.category]}`}
            >
              {qaInsightCategoryLabel(insight.category)}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
              מאמץ {insight.effort}
            </span>
            {insight.signalCount != null && insight.signalCount > 0 ? (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-800">
                {insight.signalCount}× ב-production
              </span>
            ) : null}
            {insight.qaFailureMentions > 0 ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                {insight.qaFailureMentions}× ב-QA
              </span>
            ) : null}
          </div>
          <h3 className="text-sm font-semibold leading-snug text-slate-900">{insight.title}</h3>
        </div>
        <span className="mt-1 shrink-0 text-slate-400">{open ? "▾" : "◂"}</span>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-3 text-sm leading-relaxed">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">הבעיה</p>
            <p className="mt-1 text-slate-700">{insight.problem}</p>
          </div>
          <div className="rounded-xl bg-indigo-50/80 px-3 py-2.5 ring-1 ring-indigo-100">
            <p className="text-[11px] font-semibold text-indigo-800">המלצה לפיתוח</p>
            <p className="mt-1 text-indigo-950">{insight.recommendation}</p>
          </div>
          {insight.files.length ? (
            <div>
              <p className="text-[11px] font-semibold text-slate-500">קבצים / מערכות</p>
              <ul className="mt-1 flex flex-wrap justify-end gap-1.5">
                {insight.files.map((file) => (
                  <li
                    key={file}
                    className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700"
                  >
                    {file}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

export function QaDevelopmentInsights({
  insights,
  signals,
  qaThemeDays,
}: {
  insights: EnrichedDevelopmentInsight[]
  signals: MessageInsightSignals
  qaThemeDays: number
}) {
  const [category, setCategory] = useState<QaInsightCategory | "all">("all")

  const filtered = useMemo(() => {
    if (category === "all") return insights
    return insights.filter((item) => item.category === category)
  }, [category, insights])

  const categories: { id: QaInsightCategory | "all"; label: string }[] = [
    { id: "all", label: "הכל" },
    { id: "api", label: qaInsightCategoryLabel("api") },
    { id: "runtime", label: qaInsightCategoryLabel("runtime") },
    { id: "routing", label: qaInsightCategoryLabel("routing") },
    { id: "agent", label: qaInsightCategoryLabel("agent") },
    { id: "infra", label: qaInsightCategoryLabel("infra") },
  ]

  return (
    <section className="rounded-3xl bg-white p-5 shadow-lg ring-1 ring-black/[0.06] lg:p-6">
      <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-violet-600">
            Backlog
          </p>
          <h2 className="text-xl font-bold text-slate-900">תובנות לפיתוח</h2>
          <p className="max-w-2xl text-sm text-slate-600">
            המלצות ארכיטקטורה מהקוד, מ-QA ומסкан הודעות production — ממוין לפי עדיפות + תדירות.
            ערוך את הקטלוג ב-<code className="text-xs">lib/agents/qa-development-insights.ts</code>.
          </p>
          <SignalPills signals={signals} />
        </div>
        <p className="text-[11px] text-slate-500">
          QA themes: {qaThemeDays} ימים · {insights.length} פריטים
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {categories.map((item) => {
          const active = category === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategory(item.id)}
              className={
                active
                  ? "rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                  : "rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
              }
            >
              {item.label}
            </button>
          )
        })}
      </div>

      <div className="mt-4 space-y-3">
        {filtered.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>
    </section>
  )
}
