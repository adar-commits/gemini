import Link from "next/link"
import {
  qaOutcomeLabel,
  qaOutcomeTone,
  qaPhaseLabel,
  qaRiskTone,
  qaTriggerLabel,
} from "@/lib/agents/qa-automation-labels"
import type { QaAutomationRunRow } from "@/lib/agents/qa-automation-log"
import { QaRunActions } from "@/components/qa/qa-run-actions"

const outcomeRing = {
  emerald: "bg-emerald-50 text-emerald-800 ring-emerald-600/15",
  amber: "bg-amber-50 text-amber-900 ring-amber-600/15",
  rose: "bg-rose-50 text-rose-800 ring-rose-600/15",
  orange: "bg-orange-50 text-orange-800 ring-orange-600/15",
  sky: "bg-sky-50 text-sky-800 ring-sky-600/15",
  zinc: "bg-zinc-100 text-zinc-700 ring-zinc-200",
} as const

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("he-IL", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function RiskBadge({ score }: { score: number | null }) {
  if (score == null) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  const tone = qaRiskTone(score)
  return (
    <span
      className={`inline-flex min-w-[2rem] justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ${outcomeRing[tone]}`}
    >
      {score}
    </span>
  )
}

export function QaRunTable({ runs }: { runs: QaAutomationRunRow[] }) {
  if (!runs.length) {
    return (
      <div className="rounded-2xl border border-dashed border-black/10 bg-white px-6 py-12 text-center text-sm text-muted-foreground">
        אין ריצות QA עדיין. אחרי handoff או never-stuck יופיעו כאן.
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
            className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.06]"
          >
            <div className="flex flex-wrap items-start gap-4 p-5">
              <div className="flex shrink-0 flex-col items-center gap-1">
                <RiskBadge score={run.risk_score} />
                <span className="text-[10px] text-muted-foreground">סיכון</span>
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium ring-1 ${outcomeRing[tone]}`}
                  >
                    {qaOutcomeLabel(run.outcome)}
                  </span>
                  <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600">
                    {qaPhaseLabel(run.phase)}
                  </span>
                  <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600">
                    {qaTriggerLabel(run.trigger)}
                  </span>
                  <span className="text-muted-foreground">{formatDate(run.created_at)}</span>
                </div>

                <p className="text-[15px] leading-relaxed text-foreground">
                  {run.root_cause || "—"}
                </p>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <Link
                    href={run.conversation_url}
                    className="font-mono text-[11px] text-sky-700 underline-offset-2 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    #{run.session_id}
                  </Link>
                  {run.commit_sha ? (
                    <span className="font-mono text-[11px]">{run.commit_sha.slice(0, 7)}</span>
                  ) : null}
                  {run.fix_layer ? <span>שכבה: {run.fix_layer}</span> : null}
                  {run.confidence ? <span>ביטחון: {run.confidence}</span> : null}
                </div>

                {run.fix_plan.length > 0 ? (
                  <ul className="list-inside list-disc text-xs text-muted-foreground">
                    {run.fix_plan.slice(0, 3).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : null}

                {run.operator_questions.length > 0 ? (
                  <div className="rounded-xl bg-amber-50/80 px-3 py-2 text-xs text-amber-950 ring-1 ring-amber-600/10">
                    <p className="font-medium">שאלות למפעיל:</p>
                    <ul className="mt-1 list-inside list-disc">
                      {run.operator_questions.map((q) => (
                        <li key={q}>{q}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {run.changed_files.length > 0 ? (
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {run.changed_files.join(", ")}
                  </p>
                ) : null}

                {run.operator_notes ? (
                  <p className="text-xs italic text-muted-foreground">{run.operator_notes}</p>
                ) : null}
              </div>

              <QaRunActions runId={run.id} outcome={run.outcome} />
            </div>
          </article>
        )
      })}
    </div>
  )
}
