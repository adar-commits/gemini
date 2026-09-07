import {
  countGokuReports,
  gokuGradeTo100,
  isGokuTrainerEnabled,
  listGokuReports,
  type GokuReportRow,
} from "@/lib/agents/goku-trainer"
import {
  GokuPagination,
  GokuReportFeed,
  GokuStatsBar,
} from "@/components/goku/goku-report-feed"
import { GokuQuestionsInbox } from "@/components/goku/goku-questions-inbox"
import { listGokuQuestions, type GokuQuestionRow } from "@/lib/agents/goku-questions"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 12

export default async function GokuDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1)
  const offset = (page - 1) * PAGE_SIZE

  let reports: GokuReportRow[] = []
  let total = 0
  let error: string | null = null
  let openQuestions: GokuQuestionRow[] = []
  let answeredQuestions: GokuQuestionRow[] = []

  try {
    ;[reports, total, openQuestions, answeredQuestions] = await Promise.all([
      listGokuReports({ limit: PAGE_SIZE, offset }),
      countGokuReports(),
      listGokuQuestions("open"),
      listGokuQuestions("answered"),
    ])
  } catch (err) {
    error =
      err instanceof Error ? err.message : "Failed to load GOKU reports"
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const avgGrade100 =
    reports.length > 0
      ? Math.round(
          reports.reduce((sum, report) => sum + gokuGradeTo100(report.grade), 0) /
            reports.length
        )
      : null
  const pendingApprovals = reports.reduce(
    (sum, report) =>
      sum + report.suggestions.filter((item) => item.status === "proposed").length,
    0
  )

  return (
    <div className="container mx-auto space-y-8 p-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">GOKU Trainer</h1>
          <span
            className={
              isGokuTrainerEnabled()
                ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
            }
          >
            {isGokuTrainerEnabled() ? "Active" : "Disabled"}
          </span>
        </div>
        <p className="max-w-2xl text-muted-foreground">
          Conversation summaries, quality scores, and retraining suggestions.
          High-confidence rules apply automatically; review the rest below.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-destructive">
          {error}
        </div>
      ) : (
        <>
          <GokuStatsBar
            total={total}
            avgGrade100={avgGrade100}
            pendingApprovals={pendingApprovals}
          />
          <GokuQuestionsInbox open={openQuestions} answered={answeredQuestions} />
          <GokuReportFeed reports={reports} />
          {total > PAGE_SIZE ? (
            <GokuPagination page={page} totalPages={totalPages} />
          ) : null}
        </>
      )}
    </div>
  )
}
