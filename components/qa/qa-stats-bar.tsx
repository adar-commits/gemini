import Link from "next/link"
import type { QaDashboardBucket } from "@/lib/agents/qa-automation-log"

const toneClasses = {
  default:
    "bg-white/10 text-white ring-white/15 hover:bg-white/15 backdrop-blur-md",
  review:
    "bg-sky-500/20 text-sky-50 ring-sky-300/30 hover:bg-sky-500/30 backdrop-blur-md",
  dismissed:
    "bg-zinc-500/15 text-zinc-100 ring-zinc-300/20 hover:bg-zinc-500/25 backdrop-blur-md",
  implemented:
    "bg-emerald-500/20 text-emerald-50 ring-emerald-300/30 hover:bg-emerald-500/30 backdrop-blur-md",
  risky:
    "bg-rose-500/20 text-rose-50 ring-rose-300/30 hover:bg-rose-500/30 backdrop-blur-md",
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
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card, index) => {
        const active = activeBucket === card.key
        return (
          <Link
            key={card.key}
            href={card.href}
            className={`qa-fade-up rounded-2xl px-4 py-3 shadow-lg ring-1 transition duration-300 ${toneClasses[card.tone]} ${
              active ? "scale-[1.02] ring-2 ring-white/40" : ""
            }`}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <p className="text-3xl font-bold tabular-nums tracking-tight">{card.value}</p>
            <p className="text-xs opacity-90">{card.label}</p>
          </Link>
        )
      })}
    </section>
  )
}
