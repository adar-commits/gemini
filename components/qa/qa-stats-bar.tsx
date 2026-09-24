const toneClasses = {
  default: "bg-white text-foreground ring-black/6",
  review: "bg-sky-50 text-sky-900 ring-sky-600/15",
  dismissed: "bg-zinc-100 text-zinc-800 ring-zinc-200",
  implemented: "bg-emerald-50 text-emerald-900 ring-emerald-600/15",
  risky: "bg-rose-50 text-rose-900 ring-rose-600/15",
} as const

export function QaStatsBar({
  stats,
}: {
  stats: {
    days: number
    total: number
    inReview: number
    dismissed: number
    implemented: number
    tooRisky: number
  }
}) {
  const cards = [
    { key: "all", label: "כל האירועים", value: stats.total, tone: "default" as const },
    { key: "in_review", label: "בתהליך Review", value: stats.inReview, tone: "review" as const },
    {
      key: "dismissed",
      label: "אזעקות שווא / התעלמות",
      value: stats.dismissed,
      tone: "dismissed" as const,
    },
    {
      key: "implemented",
      label: "תיקונים שבוצעו",
      value: stats.implemented,
      tone: "implemented" as const,
    },
    { key: "too_risky", label: "מסוכן מדי", value: stats.tooRisky, tone: "risky" as const },
  ]

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.key}
          className={`rounded-2xl px-4 py-3 shadow-sm ring-1 ${toneClasses[card.tone]}`}
        >
          <p className="text-2xl font-bold tabular-nums">{card.value}</p>
          <p className="text-xs opacity-80">{card.label}</p>
        </div>
      ))}
    </section>
  )
}
