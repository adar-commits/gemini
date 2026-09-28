import Link from "next/link"
import { QaDashboardHero } from "@/components/qa/qa-dashboard-hero"
import { QaDevelopmentInsights } from "@/components/qa/qa-development-insights"
import { QaManualTrigger } from "@/components/qa/qa-manual-trigger"
import { QaRunTable } from "@/components/qa/qa-run-table"
import { QaStatsBar } from "@/components/qa/qa-stats-bar"
import { getQaDevelopmentInsights } from "@/lib/agents/qa-development-insights"
import { listQaConversationContexts } from "@/lib/landbot/qa-conversation-context"
import {
  getQaAutomationStats,
  listQaAutomationRuns,
  listQaRunsBySessionIds,
  type QaDashboardBucket,
} from "@/lib/agents/qa-automation-log"
import { expireStaleQaRuns } from "@/lib/agents/qa-run-expiry"
import { drainObviousQaOperatorWaits } from "@/lib/landbot/qa-auto-continue"
import { buildQaStageTimeline } from "@/lib/agents/qa-stage-timing"

export const dynamic = "force-dynamic"

const BUCKETS: { id: QaDashboardBucket; label: string }[] = [
  { id: "all", label: "הכל" },
  { id: "in_review", label: "בתהליך Review" },
  { id: "in_development", label: "אירועים בפיתוח" },
  { id: "waiting_for_operator", label: "ממתין לתשובה" },
  { id: "dismissed", label: "אזעקות שווא / התעלמות" },
  { id: "implemented", label: "תיקונים שבוצעו" },
]

const LEGACY_BUCKET_ALIASES: Record<string, QaDashboardBucket> = {
  too_risky: "waiting_for_operator",
}

export default async function QaDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ bucket?: string; page?: string }>
}) {
  const { bucket: bucketParam, page: pageParam } = await searchParams
  const normalizedBucket =
    bucketParam && LEGACY_BUCKET_ALIASES[bucketParam]
      ? LEGACY_BUCKET_ALIASES[bucketParam]
      : bucketParam
  const bucket = (BUCKETS.some((item) => item.id === normalizedBucket)
    ? normalizedBucket
    : "all") as QaDashboardBucket
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1)
  const limit = 30
  const offset = (page - 1) * limit

  let error: string | null = null
  let runs: Awaited<ReturnType<typeof listQaAutomationRuns>>["runs"] = []
  let total = 0
  let stats: Awaited<ReturnType<typeof getQaAutomationStats>> | null = null
  let developmentInsights: Awaited<ReturnType<typeof getQaDevelopmentInsights>> | null =
    null

  try {
    await expireStaleQaRuns().catch((err) => {
      console.warn("[qa-dashboard] expire stale runs failed", err)
    })
    if (bucket === "waiting_for_operator") {
      await drainObviousQaOperatorWaits(25).catch((err) => {
        console.warn("[qa-dashboard] auto-continue obvious waits failed", err)
      })
    }
    const [listed, snapshot, insights] = await Promise.all([
      listQaAutomationRuns({
        limit,
        offset,
        bucket,
        days: 30,
      }),
      getQaAutomationStats(7),
      getQaDevelopmentInsights({ messageScanDays: 7, qaThemeDays: 30 }),
    ])
    runs = listed.runs
    total = listed.total
    stats = snapshot
    developmentInsights = insights
  } catch (err) {
    error = err instanceof Error ? err.message : "טעינת QA נכשלה"
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      </div>
    )
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const siblingsBySession = runs.length
    ? await listQaRunsBySessionIds(runs.map((run) => run.session_id))
    : new Map()
  const stageTimelines = runs.map((run) =>
    buildQaStageTimeline(run, siblingsBySession.get(run.session_id) ?? [])
  )
  const conversationContexts = runs.length
    ? await listQaConversationContexts(runs.map((run) => run.session_id))
    : new Map()

  return (
    <div className="qa-dashboard min-h-[calc(100vh-3.5rem)] bg-gradient-to-b from-slate-100 via-[#eef2ff] to-[#f6f5f3] pb-16">
      <div className="mx-auto max-w-7xl space-y-6 px-5 py-8">
        {stats ? (
          <QaDashboardHero stats={stats} stageTimelines={stageTimelines} />
        ) : null}

        {stats ? (
          <QaStatsBar stats={stats} activeBucket={bucket} />
        ) : null}

        {developmentInsights ? (
          <QaDevelopmentInsights
            insights={developmentInsights.insights}
            signals={developmentInsights.signals}
            qaThemeDays={developmentInsights.qaThemeDays}
          />
        ) : null}

        <QaManualTrigger />

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
                    ? "rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white shadow-md transition"
                    : "rounded-full bg-white/80 px-4 py-1.5 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-black/[0.06] backdrop-blur transition hover:bg-white hover:text-slate-900"
                }
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <QaRunTable
          runs={runs}
          siblingsBySession={siblingsBySession}
          conversationContexts={conversationContexts}
        />

        {totalPages > 1 ? (
          <div className="flex items-center justify-center gap-3 text-sm">
            {page > 1 ? (
              <Link
                href={`/dashboard/qa?page=${page - 1}${bucket !== "all" ? `&bucket=${bucket}` : ""}`}
                className="rounded-lg bg-white px-3 py-1.5 font-medium text-indigo-700 shadow-sm ring-1 ring-black/[0.06] hover:bg-indigo-50"
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
                className="rounded-lg bg-white px-3 py-1.5 font-medium text-indigo-700 shadow-sm ring-1 ring-black/[0.06] hover:bg-indigo-50"
              >
                הבא →
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
