import Link from "next/link"
import { QaDevelopmentInsights } from "@/components/qa/qa-development-insights"
import { getQaDevelopmentInsights } from "@/lib/agents/qa-development-insights"

export const dynamic = "force-dynamic"

export default async function QaInsightsPage() {
  let error: string | null = null
  let developmentInsights: Awaited<ReturnType<typeof getQaDevelopmentInsights>> | null =
    null

  try {
    developmentInsights = await getQaDevelopmentInsights({
      messageScanDays: 7,
      qaThemeDays: 30,
    })
  } catch (err) {
    error = err instanceof Error ? err.message : "טעינת תובנות נכשלה"
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

  return (
    <div className="qa-dashboard min-h-[calc(100vh-3.5rem)] bg-gradient-to-b from-slate-100 via-[#eef2ff] to-[#f6f5f3] pb-16">
      <div className="mx-auto max-w-7xl space-y-6 px-5 py-8">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-violet-600">
            QA · Backlog
          </p>
          <h1 className="text-2xl font-bold text-slate-900">תובנות לפיתוח</h1>
          <p className="max-w-2xl text-sm text-slate-600">
            המלצות ארכיטקטורה, סריקת הודעות production, ותמות מ-QA — ממוין לפי עדיפות.
            לרשימת האירועים חזרו ל{" "}
            <Link href="/dashboard/qa" className="font-medium text-indigo-700 hover:underline">
              דשבורד QA
            </Link>
            .
          </p>
        </header>

        {developmentInsights ? (
          <QaDevelopmentInsights
            insights={developmentInsights.insights}
            signals={developmentInsights.signals}
            qaThemeDays={developmentInsights.qaThemeDays}
          />
        ) : null}
      </div>
    </div>
  )
}
