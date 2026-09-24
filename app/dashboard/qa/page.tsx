import Link from "next/link"
import { QaRunTable } from "@/components/qa/qa-run-table"
import { QaStatsBar } from "@/components/qa/qa-stats-bar"
import {
  getQaAutomationStats,
  listQaAutomationRuns,
  type QaDashboardBucket,
} from "@/lib/agents/qa-automation-log"

export const dynamic = "force-dynamic"

const BUCKETS: { id: QaDashboardBucket; label: string }[] = [
  { id: "all", label: "הכל" },
  { id: "in_review", label: "בתהליך Review" },
  { id: "dismissed", label: "אזעקות שווא / התעלמות" },
  { id: "implemented", label: "תיקונים שבוצעו" },
  { id: "too_risky", label: "מסוכן מדי" },
]

export default async function QaDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ bucket?: string; page?: string }>
}) {
  const { bucket: bucketParam, page: pageParam } = await searchParams
  const bucket = (BUCKETS.some((item) => item.id === bucketParam)
    ? bucketParam
    : "all") as QaDashboardBucket
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1)
  const limit = 30
  const offset = (page - 1) * limit

  let error: string | null = null
  let runs: Awaited<ReturnType<typeof listQaAutomationRuns>>["runs"] = []
  let total = 0
  let stats: Awaited<ReturnType<typeof getQaAutomationStats>> | null = null

  try {
    const [listed, snapshot] = await Promise.all([
      listQaAutomationRuns({
        limit,
        offset,
        bucket,
        days: 30,
      }),
      getQaAutomationStats(7),
    ])
    runs = listed.runs
    total = listed.total
    stats = snapshot
  } catch (err) {
    error = err instanceof Error ? err.message : "טעינת QA נכשלה"
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-5 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">QA Automation</h1>
        <p className="text-sm text-muted-foreground">
          סיכום בעיה / פתרון / סיכון — auto-fix אלא אם מסוכן מדי (8+)
        </p>
      </header>

      {stats ? <QaStatsBar stats={stats} /> : null}

      <nav className="flex flex-wrap gap-2">
        {BUCKETS.map((item) => {
          const active = bucket === item.id
          const href =
            item.id === "all"
              ? "/dashboard/qa"
              : `/dashboard/qa?bucket=${encodeURIComponent(item.id)}`
          return (
            <Link
              key={item.id}
              href={href}
              className={
                active
                  ? "rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background"
                  : "rounded-full bg-white px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-black/6 hover:text-foreground"
              }
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      <QaRunTable runs={runs} />

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-3 text-sm">
          {page > 1 ? (
            <Link
              href={`/dashboard/qa?page=${page - 1}${bucket !== "all" ? `&bucket=${bucket}` : ""}`}
              className="text-sky-700 hover:underline"
            >
              ← הקודם
            </Link>
          ) : null}
          <span className="text-muted-foreground">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={`/dashboard/qa?page=${page + 1}${bucket !== "all" ? `&bucket=${bucket}` : ""}`}
              className="text-sky-700 hover:underline"
            >
              הבא →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
