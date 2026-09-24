import { formatStageDuration } from "@/lib/agents/qa-stage-timing"

export function QaStageAverages({
  averages,
}: {
  averages: {
    event: number | null
    analyze: number | null
    coding: number | null
    completed: number | null
  }
}) {
  const items = [
    { label: "ממוצע אירוע", value: averages.event },
    { label: "ממוצע ניתוח QA", value: averages.analyze },
    { label: "ממוצע Coding", value: averages.coding },
    { label: "ממוצע סה״כ", value: averages.completed },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/15 backdrop-blur-sm"
        >
          <p className="text-[10px] font-medium text-indigo-200/80">{item.label}</p>
          <p className="text-lg font-bold tabular-nums text-white">
            {formatStageDuration(item.value)}
          </p>
        </div>
      ))}
    </div>
  )
}
