import Link from "next/link"
import type { QaDashboardBucket } from "@/lib/agents/qa-automation-log"

const toneClasses = {
  default:
    "bg-white text-slate-900 ring-slate-200/80 shadow-md hover:shadow-lg hover:ring-slate-300",
  review:
    "bg-sky-100 text-sky-950 ring-sky-300 shadow-md hover:shadow-lg hover:bg-sky-50",
  dismissed:
    "bg-zinc-100 text-zinc-900 ring-zinc-300 shadow-md hover:shadow-lg hover:bg-zinc-50",
  implemented:
    "bg-emerald-100 text-emerald-950 ring-emerald-300 shadow-md hover:shadow-lg hover:bg-emerald-50",
  risky:
    "bg-rose-100 text-rose-950 ring-rose-300 shadow-md hover:shadow-lg hover:bg-rose-50",
} as const

export function QaStatsBar({
  stats,
  activeBucket = "all",
}: {
  stats: {
    days: number
    total: number
    inReview: number
    dismissed: number
    implemented: number
    tooRisky: number
  }
  activeBucket?: QaDashboardBucket
}) {
  const cards: {
    key: QaDashboardBucket
    label: string
    value: number
    tone: keyof typeof toneClasses
    href: string
  }[] = [
    {
      key: "all",
      label: "כל האירועים",
      value: stats.total,
      tone: "default",
      href: "/dashboard/qa",
    },
    {
      key: "in_review",
      label: "בתהליך Review",
      value: stats.inReview,
      tone: "review",
      href: "/dashboard/qa?bucket=in_review",
    },
    {
      key: "dismissed",
      label: "אזעקות שווא",
      value: stats.dismissed,
      tone: "dismissed",
      href: "/dashboard/qa?bucket=dismissed",
    },
    {
      key: "implemented",
      label: "תיקונים שבוצעו",
      value: stats.implemented,
      tone: "implemented",
      href: "/dashboard/qa?bucket=implemented",
    },
    {
      key: "too_risky",
      label: "מסוכן מדי",
      value: stats.tooRisky,
      tone: "risky",
      href: "/dashboard/qa?bucket=too_risky",
    },
  ]

  return (
    <section className="rounded-3xl bg-white p-4 shadow-lg ring-1 ring-black/[0.06]">
      <p className="mb-3 text-xs font-semibold text-slate-500">מדדים — 7 ימים אחרונים</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card, index) => {
          const active = activeBucket === card.key
          return (
            <Link
              key={card.key}
              href={card.href}
              className={`qa-fade-up rounded-2xl px-4 py-3 ring-1 transition duration-300 ${toneClasses[card.tone]} ${
                active ? "scale-[1.03] ring-2 ring-indigo-400" : ""
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <p className="text-3xl font-bold tabular-nums tracking-tight">{card.value}</p>
              <p className="text-xs font-medium opacity-90">{card.label}</p>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
