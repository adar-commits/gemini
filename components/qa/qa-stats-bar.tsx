import { qaRiskTone } from "@/lib/agents/qa-automation-labels"

const toneClasses = {
  emerald: "bg-emerald-50 text-emerald-800 ring-emerald-600/15",
  amber: "bg-amber-50 text-amber-900 ring-amber-600/15",
  rose: "bg-rose-50 text-rose-800 ring-rose-600/15",
  zinc: "bg-white text-foreground ring-black/6",
} as const

export function QaStatsBar({
  stats,
}: {
  stats: {
    days: number
    total: number
    triggered: number
    webhookFailed: number
    implemented: number
    falseAlarms: number
    askOperator: number
    tooRisky: number
    chained: number
    avgRisk: number | null
  }
}) {
  const cards = [
    { label: `אירועים (${stats.days} ימים)`, value: String(stats.total) },
    { label: "נשלחו ל-Grok", value: String(stats.triggered) },
    { label: "יושמו", value: String(stats.implemented) },
    { label: "אזעקות שווא", value: String(stats.falseAlarms) },
    { label: "ממתין למפעיל", value: String(stats.askOperator) },
    { label: "מסוכן / נדחה", value: String(stats.tooRisky) },
    { label: "נשלחו ל-Composer", value: String(stats.chained) },
  ]

  const riskTone = qaRiskTone(stats.avgRisk)

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/6"
        >
          <p className="text-2xl font-bold tabular-nums text-foreground">{card.value}</p>
          <p className="text-xs text-muted-foreground">{card.label}</p>
        </div>
      ))}
      <div
        className={`rounded-2xl px-4 py-3 shadow-sm ring-1 ${toneClasses[riskTone]}`}
      >
        <p className="text-2xl font-bold tabular-nums">
          {stats.avgRisk != null ? stats.avgRisk.toFixed(1) : "—"}
        </p>
        <p className="text-xs opacity-80">סיכון ממוצע (1–10)</p>
      </div>
    </section>
  )
}
