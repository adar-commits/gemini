import {
  countGokuReports,
  gokuGradeTo100,
  gokuTrainerMode,
  listWeeklyPolicyBuckets,
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
import {
  applyWeeklyPolicyAction,
  runGokuTrainerManualAction,
} from "@/app/dashboard/goku/actions"

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
  let weeklyBuckets: Awaited<ReturnType<typeof listWeeklyPolicyBuckets>> | null = null

  try {
    ;[reports, total, openQuestions, answeredQuestions, weeklyBuckets] = await Promise.all([
      listGokuReports({ limit: PAGE_SIZE, offset }),
      countGokuReports(),
      listGokuQuestions("open"),
      listGokuQuestions("answered"),
      listWeeklyPolicyBuckets(7),
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
  const trainerMode = gokuTrainerMode()
  const modeBadge =
    trainerMode === "auto"
      ? {
          label: "ריצה אוטומטית",
          className:
            "inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/15",
          dot: "size-1.5 rounded-full bg-emerald-500",
        }
      : trainerMode === "manual"
        ? {
            label: "ידני בלבד",
            className:
              "inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-sky-600/15",
            dot: "size-1.5 rounded-full bg-sky-500",
          }
        : {
            label: "כבוי",
            className:
              "inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500 ring-1 ring-zinc-200",
            dot: "size-1.5 rounded-full bg-zinc-400",
          }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-5 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              גוקו מאמן
            </h1>
            <span className={modeBadge.className}>
              <span className={modeBadge.dot} />
              {modeBadge.label}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            סיכומי שיחות, ציוני איכות והמלצות לאימון הבוט — ניתוח ידני לפי בקשה
          </p>
        </div>
      </header>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/6">
        <h2 className="text-sm font-semibold text-foreground">ניתוח שיחה ידני</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          הזן מזהה שיחה מ-Landbot (למשל 531984273). גוקו לא רץ אוטומטית אחרי סגירת שיחה.
        </p>
        <form action={runGokuTrainerManualAction} className="mt-3 flex flex-wrap gap-2">
          <input
            name="conversationId"
            type="text"
            inputMode="numeric"
            placeholder="מזהה שיחה"
            className="min-w-[220px] flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            required
          />
          <button
            type="submit"
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
          >
            נתח שיחה
          </button>
        </form>
      </section>

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

          {weeklyBuckets ? (
            <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground">
                  עדכון מדיניות שבועי
                </h2>
                <form action={applyWeeklyPolicyAction}>
                  <button
                    type="submit"
                    className="rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white"
                  >
                    החל כללים בביטחון גבוה
                  </button>
                </form>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-zinc-50 px-3 py-2 text-xs text-muted-foreground">
                  <p className="text-lg font-bold text-foreground">
                    {weeklyBuckets.totals.wrong_tool_usage}
                  </p>
                  בעיות שימוש בכלים
                </div>
                <div className="rounded-xl bg-zinc-50 px-3 py-2 text-xs text-muted-foreground">
                  <p className="text-lg font-bold text-foreground">
                    {weeklyBuckets.totals.kb_gap}
                  </p>
                  פערי ידע
                </div>
                <div className="rounded-xl bg-zinc-50 px-3 py-2 text-xs text-muted-foreground">
                  <p className="text-lg font-bold text-foreground">
                    {weeklyBuckets.totals.prompt_tweak}
                  </p>
                  שיפורי פרומפט
                </div>
                <div className="rounded-xl bg-zinc-50 px-3 py-2 text-xs text-muted-foreground">
                  <p className="text-lg font-bold text-foreground">
                    {weeklyBuckets.totals.ready_high_confidence}
                  </p>
                  מוכנים להפעלה
                </div>
              </div>
            </section>
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
