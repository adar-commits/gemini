import Link from "next/link"
import { QaRunTable } from "@/components/qa/qa-run-table"
import { QaStatsBar } from "@/components/qa/qa-stats-bar"
import {
  getQaAutomationStats,
  listQaAutomationRuns,
} from "@/lib/agents/qa-automation-log"

export const dynamic = "force-dynamic"

const OUTCOMES = [
  { id: "", label: "הכל" },
  { id: "triggered", label: "נשלח לניתוח" },
  { id: "implemented", label: "יושם" },
  { id: "false_alarm", label: "אזעקת שווא" },
  { id: "chained", label: "נשלח ליישום" },
  { id: "webhook_failed", label: "Webhook נכשל" },
  { id: "ask_operator", label: "ממתין למפעיל" },
  { id: "too_risky", label: "מסוכן" },
  { id: "no_action", label: "ללא פעולה" },
  { id: "vanished", label: "בוטל" },
] as const

export default async function QaDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ outcome?: string; page?: string }>
}) {
  const { outcome: outcomeFilter, page: pageParam } = await searchParams
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
        outcome: outcomeFilter?.trim() || undefined,
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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            QA Automation
          </h1>
          <p className="text-sm text-muted-foreground">
            מעקב אחר ניתוח Grok ויישום Composer — יושם / התעלמות / אזעקת שווא / סיכון
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          revert: <code className="rounded bg-zinc-100 px-1">npm run qa:vanish -- &lt;sha&gt;</code>
        </p>
      </header>

      {stats ? <QaStatsBar stats={stats} /> : null}

      <nav className="flex flex-wrap gap-2">
        {OUTCOMES.map((item) => {
          const active = (outcomeFilter ?? "") === item.id
          const href = item.id
            ? `/dashboard/qa?outcome=${encodeURIComponent(item.id)}`
            : "/dashboard/qa"
          return (
            <Link
              key={item.id || "all"}
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
              href={`/dashboard/qa?page=${page - 1}${outcomeFilter ? `&outcome=${outcomeFilter}` : ""}`}
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
              href={`/dashboard/qa?page=${page + 1}${outcomeFilter ? `&outcome=${outcomeFilter}` : ""}`}
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
