import Link from "next/link"
import { GokuGradeRing } from "@/components/goku/goku-grade-ring"
import { GokuSuggestionList } from "@/components/goku/goku-suggestion-list"
import { Button } from "@/components/ui/button"
import type { GokuAnalysis, GokuCloseReason, GokuReportRow } from "@/lib/agents/goku-trainer"

function closeReasonLabel(reason: GokuCloseReason) {
  switch (reason) {
    case "inactivity_close":
      return "חוסר פעילות"
    case "reset":
      return "איפוס"
    case "end":
      return "סיום"
    case "stale_expire":
      return "פג תוקף"
    default:
      return reason
  }
}

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

function improvementBullets(analysis: GokuAnalysis) {
  return Array.from(
    new Set([
      ...analysis.weaknesses,
      ...analysis.routing_issues,
      ...analysis.kb_gaps,
    ])
  )
    .filter(Boolean)
    .slice(0, 5)
}

function ReportCard({ report }: { report: GokuReportRow }) {
  const bullets = improvementBullets(report.analysis)
  const pending = report.suggestions.filter((item) => item.status === "proposed").length
  const hasDetails = bullets.length > 0 || report.suggestions.length > 0

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.06]">
      <div className="flex gap-4 p-5">
        <GokuGradeRing grade={report.grade} size="sm" />

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600">
              {closeReasonLabel(report.close_reason)}
            </span>
            <span>{formatDate(report.created_at)}</span>
            <span className="font-mono text-[11px]">#{report.conversation_id}</span>
            {pending > 0 ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800 ring-1 ring-amber-600/15">
                {pending} ממתינים לאישור
              </span>
            ) : report.suggestions.length > 0 ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 ring-1 ring-emerald-600/15">
                הכל נבדק
              </span>
            ) : null}
          </div>

          <p className="text-[15px] leading-relaxed text-foreground">
            {report.summary || "אין סיכום."}
          </p>
        </div>
      </div>

      {hasDetails ? (
        <details
          className="group border-t border-black/[0.05]"
          open={pending > 0}
        >
          <summary className="cursor-pointer list-none px-5 py-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-1.5">
              <span className="transition-transform group-open:rotate-180">▾</span>
              פרטים ושיפורים
            </span>
          </summary>

          <div className="space-y-4 border-t border-black/[0.04] bg-zinc-50/50 px-5 py-4">
            {bullets.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-semibold text-foreground">
                  נקודות לשיפור
                </p>
                <ul className="space-y-1.5">
                  {bullets.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2 text-sm leading-relaxed text-muted-foreground"
                    >
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-zinc-300" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {report.suggestions.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-semibold text-foreground">
                  פעולות אימון
                </p>
                <GokuSuggestionList
                  reportId={report.id}
                  suggestions={report.suggestions}
                />
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </article>
  )
}

export function GokuReportFeed({ reports }: { reports: GokuReportRow[] }) {
  if (!reports.length) {
    return (
      <div className="rounded-2xl bg-white px-8 py-14 text-center shadow-sm ring-1 ring-black/[0.06]">
        <p className="text-base font-medium text-foreground">אין דוחות עדיין</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          דוחות יופיעו כששיחות ייסגרו וגוקו מאמן פעיל
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
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
  openQuestions,
}: {
  total: number
  avgGrade100: number | null
  pendingApprovals: number
  openQuestions: number
}) {
  const stats = [
    { label: "דוחות", value: total.toString() },
    {
      label: "ציון ממוצע",
      value: avgGrade100 != null ? `${avgGrade100}` : "—",
      suffix: avgGrade100 != null ? "/100" : undefined,
    },
    { label: "ממתין לאישור", value: pendingApprovals.toString() },
    ...(openQuestions > 0
      ? [{ label: "שאלות פתוחות", value: openQuestions.toString() }]
      : []),
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex min-w-[120px] flex-1 items-baseline gap-2 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/[0.06]"
        >
          <span className="text-2xl font-bold tabular-nums text-foreground">
            {stat.value}
            {stat.suffix ? (
              <span className="text-sm font-normal text-muted-foreground">
                {stat.suffix}
              </span>
            ) : null}
          </span>
          <span className="text-xs text-muted-foreground">{stat.label}</span>
        </div>
      ))}
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
    <div className="flex items-center justify-between gap-4 pt-2">
      <p className="text-sm text-muted-foreground">
        עמוד {page} מתוך {totalPages || 1}
      </p>
      <nav className="flex items-center gap-2">
        {hasNext ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/goku?page=${page + 1}`}>הבא</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            הבא
          </Button>
        )}
        {hasPrev ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/goku?page=${page - 1}`}>הקודם</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            הקודם
          </Button>
        )}
      </nav>
    </div>
  )
}
