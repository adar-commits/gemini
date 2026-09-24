import type { QaAutomationRunRow } from "@/lib/agents/qa-automation-log"
import { QaRunCard } from "@/components/qa/qa-run-card"

export function QaRunTable({ runs }: { runs: QaAutomationRunRow[] }) {
  if (!runs.length) {
    return (
      <div className="qa-fade-up rounded-3xl border border-dashed border-white/20 bg-white/5 px-6 py-16 text-center backdrop-blur-sm">
        <p className="text-lg font-semibold text-white/90">אין אירועים בקטגוריה זו</p>
        <p className="mt-1 text-sm text-indigo-200/70">אירועים חדשים יופיעו אחרי handoff או never-stuck</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {runs.map((run, index) => (
        <QaRunCard key={run.id} run={run} index={index} />
      ))}
    </div>
  )
}
