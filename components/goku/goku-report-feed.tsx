import Link from "next/link"
import { GokuGradeRing } from "@/components/goku/goku-grade-ring"
import { GokuSuggestionList } from "@/components/goku/goku-suggestion-list"
import { Button } from "@/components/ui/button"
import type { GokuAnalysis, GokuCloseReason, GokuReportRow } from "@/lib/agents/goku-trainer"
import { cn } from "@/lib/utils"

function closeReasonLabel(reason: GokuCloseReason) {
  switch (reason) {
    case "inactivity_close":
      return "Closed — inactivity"
    case "reset":
      return "Reset"
    case "end":
      return "Ended"
    case "stale_expire":
      return "Stale expiry"
    default:
      return reason
  }
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("he-IL", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function improvementBullets(analysis: GokuAnalysis) {
  const bullets = [
    ...analysis.weaknesses,
    ...analysis.routing_issues,
    ...analysis.kb_gaps,
    ...analysis.tone_issues,
    ...analysis.missed_tools,
  ].filter(Boolean)

  return Array.from(new Set(bullets)).slice(0, 8)
}

function ReportCard({ report }: { report: GokuReportRow }) {
  const bullets = improvementBullets(report.analysis)
  const pending = report.suggestions.filter((item) => item.status === "proposed").length
  const applied = report.suggestions.filter((item) => item.status === "applied").length

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
      <div className="grid gap-6 border-b border-border p-6 lg:grid-cols-[auto_1fr_auto] lg:items-start">
        <GokuGradeRing grade={report.grade} />

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {closeReasonLabel(report.close_reason)}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              #{report.conversation_id}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDate(report.created_at)}
            </span>
          </div>

          <p
            className="text-base leading-relaxed text-foreground"
            dir="auto"
          >
            {report.summary || "No summary available."}
          </p>

          {report.analysis.strengths.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                What worked
              </p>
              <ul className="list-disc space-y-1 ps-5 text-sm text-muted-foreground">
                {report.analysis.strengths.slice(0, 4).map((item) => (
                  <li key={item} dir="auto">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 text-right text-xs text-muted-foreground lg:min-w-[120px]">
          <span
            className={cn(
              "inline-flex self-end rounded-full px-2.5 py-1 font-medium",
              pending > 0
                ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
            )}
          >
            {pending > 0 ? `${pending} pending` : "All reviewed"}
          </span>
          <span>{applied} rules live</span>
          {report.model ? <span className="truncate">{report.model}</span> : null}
        </div>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Improvements</h3>
          {bullets.length ? (
            <ul className="list-disc space-y-2 ps-5 text-sm leading-relaxed text-muted-foreground">
              {bullets.map((item) => (
                <li key={item} dir="auto">
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No improvement bullets recorded.
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Retraining actions</h3>
          <GokuSuggestionList
            reportId={report.id}
            suggestions={report.suggestions}
          />
        </section>
      </div>
    </article>
  )
}

export function GokuReportFeed({ reports }: { reports: GokuReportRow[] }) {
  if (!reports.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-12 text-center">
        <p className="text-lg font-medium">No GOKU reports yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Reports appear when conversations close and{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            GOKU_TRAINER_ENABLED
          </code>{" "}
          is on.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {reports.map((report) => (
        <ReportCard key={report.id} report={report} />
      ))}
    </div>
  )
}

export function GokuStatsBar({
  total,
  avgGrade100,
  pendingApprovals,
}: {
  total: number
  avgGrade100: number | null
  pendingApprovals: number
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Reports
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{total}</p>
      </div>
      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Avg score
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {avgGrade100 != null ? `${avgGrade100}/100` : "—"}
        </p>
      </div>
      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Pending approval
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {pendingApprovals}
        </p>
      </div>
    </div>
  )
}

export function GokuPagination({
  page,
  totalPages,
}: {
  page: number
  totalPages: number
}) {
  const hasPrev = page > 1
  const hasNext = page < totalPages

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages || 1}
      </p>
      <nav className="flex items-center gap-2">
        {hasPrev ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/goku?page=${page - 1}`}>Previous</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
        )}
        {hasNext ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/goku?page=${page + 1}`}>Next</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next
          </Button>
        )}
      </nav>
    </div>
  )
}
