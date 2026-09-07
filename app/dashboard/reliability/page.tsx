import { getReliabilitySnapshot } from "@/lib/agents/reliability"

export const dynamic = "force-dynamic"

function formatNumber(value: number) {
  return new Intl.NumberFormat("he-IL").format(value)
}

function formatPct(value: number) {
  return `${value.toFixed(1)}%`
}

export default async function ReliabilityDashboardPage() {
  let error: string | null = null
  let snapshot = null as Awaited<ReturnType<typeof getReliabilitySnapshot>> | null

  try {
    snapshot = await getReliabilitySnapshot({ days: 7 })
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load reliability snapshot"
  }

  if (error || !snapshot) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? "Unknown error"}
        </div>
      </div>
    )
  }

  const cards = [
    { label: "פניות (7 ימים)", value: formatNumber(snapshot.totals.turns) },
    { label: "מעברי אדם", value: formatPct(snapshot.totals.handoffRate) },
    { label: "התאוששות כלי→LLM", value: formatPct(snapshot.totals.recoverRate) },
    { label: "חזרתיות תשובת בוט", value: formatPct(snapshot.totals.repeatAssistantRate) },
    { label: "ציון גוקו ממוצע", value: snapshot.totals.avgGokuGrade?.toFixed(1) ?? "—" },
    { label: "יחס LLM turns", value: formatPct((snapshot.totals.llmTurns / Math.max(1, snapshot.totals.turns)) * 100) },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-5 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Reliability Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          חלון ניתוח של 7 ימים: זיהוי עומסים, התאוששות מכלים ויציבות שיחה
        </p>
      </header>

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/6"
          >
            <p className="text-2xl font-bold tabular-nums text-foreground">{card.value}</p>
            <p className="text-xs text-muted-foreground">{card.label}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/6">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Top Routing Paths</h2>
          <div className="space-y-2">
            {snapshot.routingPaths.map((row) => (
              <div key={row.key} className="flex items-center justify-between text-sm">
                <span className="font-mono text-[12px] text-muted-foreground">{row.key}</span>
                <span className="tabular-nums font-medium text-foreground">
                  {formatNumber(row.count)}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/6">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Top Models by Input Tokens</h2>
          <div className="space-y-2">
            {snapshot.modelsByTokens.map((row) => (
              <div key={row.model} className="space-y-0.5 border-b border-black/5 pb-2 last:border-b-0">
                <p className="font-mono text-[12px] text-foreground">{row.model}</p>
                <p className="text-xs text-muted-foreground">
                  input: {formatNumber(row.inputTokens)} · output: {formatNumber(row.outputTokens)}
                </p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/6">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Token Load</h2>
        <p className="text-sm text-muted-foreground">
          input {formatNumber(snapshot.totals.inputTokens)} · output{" "}
          {formatNumber(snapshot.totals.outputTokens)}
        </p>
      </section>
    </div>
  )
}
