import Link from "next/link"
import { qaOutcomeLabel, qaOutcomeTone, qaTriggerLabel } from "@/lib/agents/qa-automation-labels"
import type { QaAutomationRunRow } from "@/lib/agents/qa-automation-log"
import { formatJerusalemDashboardDateTime } from "@/lib/agents/hebrew-date-format"
import {
  qaRunConversationUrl,
  qaRunProblem,
  qaRunRiskLabel,
  qaRunSolution,
} from "@/lib/agents/qa-run-summary"
import { qaPhaseLabel } from "@/lib/agents/qa-automation-labels"
import { QaRunToolbar } from "@/components/qa/qa-run-toolbar"
import { resolveQaRunRetryTarget } from "@/lib/landbot/qa-run-retry"

const outcomeRing = {
  emerald: "bg-emerald-50 text-emerald-800 ring-emerald-600/15",
  amber: "bg-amber-50 text-amber-900 ring-amber-600/15",
  rose: "bg-rose-50 text-rose-800 ring-rose-600/15",
  orange: "bg-orange-50 text-orange-800 ring-orange-600/15",
  sky: "bg-sky-50 text-sky-800 ring-sky-600/15",
  zinc: "bg-zinc-100 text-zinc-700 ring-zinc-200",
} as const

export function QaRunTable({ runs }: { runs: QaAutomationRunRow[] }) {
  if (!runs.length) {
    return (
      <div className="rounded-2xl border border-dashed border-black/10 bg-white px-6 py-12 text-center text-sm text-muted-foreground">
        אין אירועים בקטגוריה זו.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {runs.map((run) => {
        const tone = qaOutcomeTone(run.outcome)
        return (
          <article
            key={run.id}
            className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/[0.06]"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-xs">
                <span
                  className={`rounded-full px-2 py-0.5 font-medium ring-1 ${outcomeRing[tone]}`}
                >
                  {qaOutcomeLabel(run.outcome)}
                </span>
                <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600">
                  {qaTriggerLabel(run.trigger)}
                </span>
                <span className="rounded-md bg-zinc-50 px-2 py-0.5 text-zinc-600">
                  {qaPhaseLabel(run.phase)}
                </span>
                <span className="text-muted-foreground" title="Asia/Jerusalem">
                  {formatJerusalemDashboardDateTime(run.created_at)}
                </span>
                <Link
                  href={qaRunConversationUrl(run)}
                  className="text-sky-700 underline-offset-2 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  פתח שיחה
                </Link>
                <span className="font-mono text-[11px] text-muted-foreground">
                  #{run.session_id}
                </span>
                {run.commit_sha ? (
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {run.commit_sha.slice(0, 7)}
                  </span>
                ) : null}
              </div>
              <QaRunToolbar
                runId={run.id}
                retryTarget={resolveQaRunRetryTarget(run)}
              />
            </div>

            <dl className="space-y-2 text-sm leading-relaxed">
              <div>
                <dt className="font-semibold text-foreground">הבעיה:</dt>
                <dd className="text-muted-foreground">{qaRunProblem(run)}</dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">הפתרון:</dt>
                <dd className="text-muted-foreground">{qaRunSolution(run)}</dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">סיכון:</dt>
                <dd className="text-muted-foreground">{qaRunRiskLabel(run)}</dd>
              </div>
            </dl>
          </article>
        )
      })}
    </div>
  )
}
