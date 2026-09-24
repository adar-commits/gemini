import type { QaAutomationRunRow } from "@/lib/agents/qa-automation-log"
import { buildQaScorecard } from "@/lib/agents/qa-scorecard"

export function QaScorecard({ run }: { run: QaAutomationRunRow }) {
  const { llmDominancy, mainFault } = buildQaScorecard(run)

  return (
    <section className="rounded-2xl bg-gradient-to-l from-violet-50/90 to-transparent p-4 ring-1 ring-violet-100/80">
      <h3 className="mb-3 text-sm font-bold text-violet-900">כרטיס ציון</h3>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wide text-violet-700/70">
            דומיננטיות LLM
          </dt>
          <dd className="mt-1 flex items-baseline gap-1.5">
            {llmDominancy != null ? (
              <>
                <span className="text-2xl font-bold tabular-nums text-violet-950">
                  {llmDominancy}
                </span>
                <span className="text-xs text-violet-700/80">/ 10</span>
              </>
            ) : (
              <span className="text-sm text-violet-800/70">—</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wide text-violet-700/70">
            תקלה עיקרית
          </dt>
          <dd className="mt-1 text-sm leading-snug text-violet-950/85">
            {mainFault}
          </dd>
        </div>
      </dl>
    </section>
  )
}
