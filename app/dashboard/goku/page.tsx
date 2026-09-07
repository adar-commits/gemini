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
      err instanceof Error ? err.message : "טעינת דוחות גוקו נכשלה"
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
    <div className="mx-auto max-w-6xl space-y-8 px-5 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              גוקו מאמן
            </h1>
            <span
              className={
                isGokuTrainerEnabled()
                  ? "inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/15"
                  : "inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500 ring-1 ring-zinc-200"
              }
            >
              <span
                className={
                  isGokuTrainerEnabled()
                    ? "size-1.5 rounded-full bg-emerald-500"
                    : "size-1.5 rounded-full bg-zinc-400"
                }
              />
              {isGokuTrainerEnabled() ? "פעיל" : "כבוי"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            סיכומי שיחות, ציוני איכות והמלצות לאימון הבוט
          </p>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : (
        <>
          <GokuStatsBar
            total={total}
            avgGrade100={avgGrade100}
            pendingApprovals={pendingApprovals}
            openQuestions={openQuestions.length}
          />

          {openQuestions.length > 0 || answeredQuestions.length > 0 ? (
            <GokuQuestionsInbox open={openQuestions} answered={answeredQuestions} />
          ) : null}

          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground">
              דוחות שיחות
              {total > 0 ? (
                <span className="ms-2 font-normal text-muted-foreground">
                  ({total})
                </span>
              ) : null}
            </h2>
            <GokuReportFeed reports={reports} />
          </section>

          {total > PAGE_SIZE ? (
            <GokuPagination page={page} totalPages={totalPages} />
          ) : null}
        </>
      )}
    </div>
  )
}
