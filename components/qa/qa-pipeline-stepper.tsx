import type { QaPipelineStep } from "@/lib/agents/qa-run-display"

const stateStyles = {
  done: {
    dot: "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.55)]",
    line: "bg-emerald-400/60",
    text: "text-emerald-800",
  },
  active: {
    dot: "bg-sky-500 qa-spin-ring shadow-[0_0_14px_rgba(14,165,233,0.6)]",
    line: "bg-sky-300/50",
    text: "text-sky-800 font-semibold",
  },
  pending: {
    dot: "bg-zinc-200",
    line: "bg-zinc-200",
    text: "text-zinc-400",
  },
  failed: {
    dot: "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.5)]",
    line: "bg-rose-300/50",
    text: "text-rose-700 font-semibold",
  },
} as const

export function QaPipelineStepper({
  steps,
  progress,
}: {
  steps: QaPipelineStep[]
  progress: number
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>צינור QA</span>
        <span className="tabular-nums">{progress}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="qa-progress-bar h-full rounded-full bg-gradient-to-l from-sky-500 via-indigo-500 to-violet-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <ol className="space-y-1.5 pt-1">
        {steps.map((step, index) => {
          const style = stateStyles[step.state]
          return (
            <li key={step.id} className="flex items-center gap-2">
              <span className={`relative h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`}>
                {step.state === "active" ? (
                  <span className="qa-pulse absolute inset-0 rounded-full bg-sky-400/40" />
                ) : null}
              </span>
              <span className={`text-xs ${style.text}`}>{step.label}</span>
              {index < steps.length - 1 ? (
                <span className={`ms-auto hidden h-px w-6 sm:block ${style.line}`} />
              ) : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
