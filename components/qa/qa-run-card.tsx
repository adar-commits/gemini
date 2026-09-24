import Link from "next/link"
import {
  qaOutcomeLabel,
  qaOutcomeTone,
  qaPhaseLabel,
  qaTriggerLabel,
} from "@/lib/agents/qa-automation-labels"
import type { QaAutomationRunRow } from "@/lib/agents/qa-automation-log"
import { formatJerusalemDashboardDateTime } from "@/lib/agents/hebrew-date-format"
import {
  formatQaElapsedHebrew,
  isQaRunActive,
  qaConfidenceLabel,
  qaFixLayerLabel,
  qaPipelineProgress,
  qaPipelineSteps,
  qaVerdictLabel,
} from "@/lib/agents/qa-run-display"
import {
  qaRunConversationUrl,
  qaRunProblem,
  qaRunRiskLabel,
  qaRunSolution,
} from "@/lib/agents/qa-run-summary"
import { resolveQaRunRetryTarget } from "@/lib/landbot/qa-run-retry"
import type { QaConversationContext } from "@/lib/landbot/qa-conversation-context"
import { QaElapsedTimer } from "@/components/qa/qa-elapsed-timer"
import { QaScorecard } from "@/components/qa/qa-scorecard"
import { QaPipelineStepper } from "@/components/qa/qa-pipeline-stepper"
import { QaRiskGauge } from "@/components/qa/qa-risk-gauge"
import { QaRunToolbar } from "@/components/qa/qa-run-toolbar"
import { QaStageTimeline } from "@/components/qa/qa-stage-timeline"
import { buildQaStageTimeline, qaRunTotalElapsedMs } from "@/lib/agents/qa-stage-timing"

const outcomeStyles = {
  emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-800 ring-emerald-500/25",
  amber: "from-amber-500/15 to-amber-500/5 text-amber-900 ring-amber-500/25",
  rose: "from-rose-500/15 to-rose-500/5 text-rose-800 ring-rose-500/25",
  orange: "from-orange-500/15 to-orange-500/5 text-orange-800 ring-orange-500/25",
  sky: "from-sky-500/15 to-sky-500/5 text-sky-900 ring-sky-500/25",
  zinc: "from-zinc-500/10 to-zinc-500/5 text-zinc-700 ring-zinc-300/60",
} as const

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-2.5 py-1.5 ring-1 ring-black/[0.04]">
      <dt className="text-[10px] font-medium text-muted-foreground">{label}</dt>
      <dd className="text-xs font-semibold text-foreground">{value}</dd>
    </div>
  )
}

export function QaRunCard({
  run,
  index,
  siblings = [],
  conversation = null,
}: {
  run: QaAutomationRunRow
  index: number
  siblings?: QaAutomationRunRow[]
  conversation?: QaConversationContext | null
}) {
  const tone = qaOutcomeTone(run.outcome)
  const steps = qaPipelineSteps(run)
  const progress = qaPipelineProgress(steps)
  const stageTimeline = buildQaStageTimeline(run, siblings)
  const totalElapsed = formatQaElapsedHebrew(qaRunTotalElapsedMs(run, siblings))
  const active = isQaRunActive(run.outcome)
  const conversationUrl = qaRunConversationUrl(run)
  const anchorIso = run.updated_at || run.created_at

  return (
    <article
      className="qa-fade-up group relative overflow-hidden rounded-3xl bg-white/95 shadow-[0_8px_40px_-12px_rgba(15,23,42,0.18)] ring-1 ring-black/[0.06] backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_48px_-12px_rgba(15,23,42,0.22)]"
      style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
    >
      <div className="pointer-events-none absolute -left-20 -top-20 h-40 w-40 rounded-full bg-sky-400/10 blur-3xl transition group-hover:bg-indigo-400/15" />

      <div className="border-b border-black/[0.05] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-l px-3 py-1 text-xs font-semibold ring-1 ${outcomeStyles[tone]}`}
            >
              {active ? (
                <span className="qa-spinner h-3 w-3 rounded-full border-2 border-current border-t-transparent" />
              ) : null}
              {qaOutcomeLabel(run.outcome)}
            </span>
            <span className="rounded-lg bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
              {qaTriggerLabel(run.trigger)}
            </span>
            <span className="rounded-lg bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
              {qaPhaseLabel(run.phase)}
            </span>
          </div>
          <QaRunToolbar
            runId={run.id}
            retryTarget={resolveQaRunRetryTarget(run)}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <time dateTime={run.created_at} title="Asia/Jerusalem">
              {formatJerusalemDashboardDateTime(run.created_at)}
            </time>
            <span className="hidden h-3 w-px bg-zinc-200 sm:block" />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-white">
              <span className="opacity-70">סה״כ</span>
              {active ? (
                <QaElapsedTimer sinceIso={run.created_at} live />
              ) : (
                totalElapsed
              )}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-medium text-indigo-900">
              <span className="opacity-70">עודכן לפני</span>
              <QaElapsedTimer sinceIso={anchorIso} live={active} />
            </span>
            <span className="font-mono text-[11px]">#{run.session_id}</span>
            {conversation?.customerName ? (
              <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-900">
                {conversation.customerName}
              </span>
            ) : null}
            {conversation?.messageCount != null ? (
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-700">
                {conversation.messageCount} הודעות
              </span>
            ) : null}
            {conversation?.department ? (
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-800">
                {conversation.department}
              </span>
            ) : null}
          </div>
          <Link
            href={conversationUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-l from-indigo-600 to-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:from-indigo-500 hover:to-sky-500"
          >
            פתח שיחה
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3.5 w-3.5 opacity-90"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M4.25 5.5a.75.75 0 0 1 .75-.75h10a.75.75 0 0 1 0 1.5H5a.75.75 0 0 1-.75-.75Zm0 4.5a.75.75 0 0 1 .75-.75h10a.75.75 0 0 1 0 1.5H5a.75.75 0 0 1-.75-.75Zm0 4.5a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5h-6a.75.75 0 0 1-.75-.75Z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
        </div>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-4">
          <section className="rounded-2xl bg-gradient-to-l from-rose-50/80 to-transparent p-4 ring-1 ring-rose-100/80">
            <h3 className="mb-1.5 flex items-center gap-2 text-sm font-bold text-rose-900">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-100 text-xs">
                !
              </span>
              הבעיה
            </h3>
            <p className="text-sm leading-relaxed text-rose-950/80">{qaRunProblem(run)}</p>
          </section>

          <section className="rounded-2xl bg-gradient-to-l from-emerald-50/80 to-transparent p-4 ring-1 ring-emerald-100/80">
            <h3 className="mb-1.5 flex items-center gap-2 text-sm font-bold text-emerald-900">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-xs">
                ✓
              </span>
              הפתרון
            </h3>
            <p className="text-sm leading-relaxed text-emerald-950/80">{qaRunSolution(run)}</p>
            {run.fix_plan.length > 1 ? (
              <ul className="mt-3 space-y-1.5 border-t border-emerald-100/80 pt-3 text-xs text-emerald-900/75">
                {run.fix_plan.slice(1).map((line) => (
                  <li key={line.slice(0, 40)} className="flex gap-2">
                    <span className="text-emerald-500">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <QaScorecard run={run} />

          <details className="group/details rounded-2xl bg-zinc-50/80 p-4 ring-1 ring-black/[0.04]">
            <summary className="cursor-pointer text-sm font-semibold text-foreground marker:content-none">
              <span className="inline-flex items-center gap-2">
                פרטי שיחה וניתוח
                <span className="text-xs font-normal text-muted-foreground group-open/details:hidden">
                  (הרחב)
                </span>
              </span>
            </summary>
            <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <MetaChip label="מספר שיחה" value={run.session_id} />
              <MetaChip
                label="לקוח Landbot"
                value={run.landbot_customer_id ?? "—"}
              />
              <MetaChip label="ורדיקט" value={qaVerdictLabel(run.verdict)} />
              <MetaChip label="ביטחון" value={qaConfidenceLabel(run.confidence)} />
              <MetaChip label="שכבת תיקון" value={qaFixLayerLabel(run.fix_layer)} />
              <MetaChip label="סיכון" value={qaRunRiskLabel(run)} />
              {run.commit_sha ? (
                <MetaChip label="קומיט" value={run.commit_sha.slice(0, 7)} />
              ) : null}
              {run.changed_files.length ? (
                <div className="rounded-lg bg-zinc-50 px-2.5 py-1.5 ring-1 ring-black/[0.04] sm:col-span-2">
                  <dt className="text-[10px] font-medium text-muted-foreground">קבצים</dt>
                  <dd className="mt-0.5 font-mono text-[11px] text-foreground">
                    {run.changed_files.join(", ")}
                  </dd>
                </div>
              ) : null}
            </dl>
            {run.operator_notes ? (
              <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-muted-foreground ring-1 ring-black/[0.04]">
                <span className="font-semibold text-foreground">הערות: </span>
                {run.operator_notes}
              </p>
            ) : null}
            <p className="mt-3 break-all text-[11px] text-muted-foreground">
              {conversationUrl}
            </p>
          </details>
        </div>

        <aside className="space-y-4 lg:border-r lg:border-black/[0.05] lg:pr-5">
          <QaStageTimeline segments={stageTimeline} />
          <QaPipelineStepper steps={steps} progress={progress} />
          <div className="flex items-center justify-center rounded-2xl bg-zinc-50/90 p-3 ring-1 ring-black/[0.04]">
            <QaRiskGauge score={run.risk_score} />
          </div>
        </aside>
      </div>
    </article>
  )
}
