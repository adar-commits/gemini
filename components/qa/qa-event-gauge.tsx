import type {
  QaEventProgress,
  QaEventStageState,
  QaEventTone,
} from "@/lib/agents/qa-event-stages"

const CX = 100
const CY = 96
const R = 78
const STROKE = 15
const GAP_DEG = 2.2

const segmentColor: Record<QaEventStageState, string> = {
  done: "#10b981",
  active: "#0ea5e9",
  waiting: "#f59e0b",
  failed: "#f43f5e",
  skipped: "#e4e4e7",
  pending: "#f1f5f9",
}

const toneText: Record<QaEventTone, string> = {
  active: "text-sky-800",
  done: "text-emerald-700",
  waiting: "text-amber-700",
  failed: "text-rose-700",
  closed: "text-zinc-600",
}

const dotClass: Record<QaEventStageState, string> = {
  done: "bg-emerald-500",
  active: "bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.6)]",
  waiting: "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.55)]",
  failed: "bg-rose-500",
  skipped: "bg-zinc-200",
  pending: "bg-zinc-200",
}

const labelClass: Record<QaEventStageState, string> = {
  done: "text-emerald-900",
  active: "font-semibold text-sky-800",
  waiting: "font-semibold text-amber-800",
  failed: "font-semibold text-rose-700",
  skipped: "text-zinc-400 line-through",
  pending: "text-zinc-400",
}

const timeFormat = new Intl.DateTimeFormat("he-IL", {
  timeZone: "Asia/Jerusalem",
  hour: "2-digit",
  minute: "2-digit",
})

function point(angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: CX + R * Math.cos(rad), y: CY - R * Math.sin(rad) }
}

/** Arc from angle a to b (degrees, 0 = right, 180 = left) — stage 1 starts on the right for RTL. */
function arcPath(a: number, b: number) {
  const start = point(a)
  const end = point(b)
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${R} ${R} 0 0 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}

function formatTime(iso: string | null) {
  if (!iso) return null
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? timeFormat.format(ms) : null
}

export function QaEventGauge({ progress }: { progress: QaEventProgress }) {
  const span = 180 / progress.stages.length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>סטטוס האירוע</span>
        <span className="tabular-nums">{progress.percent}%</span>
      </div>

      <div className="relative mx-auto w-full max-w-[210px]">
        <svg viewBox="0 0 200 112" className="w-full" role="img" aria-label={progress.headline}>
          {progress.stages.map((stage, index) => {
            const a = index * span + GAP_DEG / 2
            const b = (index + 1) * span - GAP_DEG / 2
            return (
              <path
                key={stage.id}
                d={arcPath(a, b)}
                fill="none"
                stroke={segmentColor[stage.state]}
                strokeWidth={STROKE}
                strokeLinecap="butt"
                className={stage.state === "active" ? "qa-segment-blink" : undefined}
              >
                <title>{`${index + 1}. ${stage.label}`}</title>
              </path>
            )
          })}
        </svg>
        <div className="pointer-events-none absolute inset-x-0 bottom-1 text-center">
          <span className="text-xl font-bold tabular-nums text-foreground">
            {progress.position}
            <span className="text-sm font-medium text-muted-foreground">/{progress.stages.length}</span>
          </span>
        </div>
      </div>

      <p className={`text-center text-xs font-semibold leading-snug ${toneText[progress.tone]}`}>
        {progress.headline}
      </p>
      {progress.stale ? (
        <p className="rounded-lg bg-amber-50 px-2 py-1 text-center text-[11px] text-amber-800 ring-1 ring-amber-100">
          אין עדכון מהאוטומציה 10+ דק׳ — בדוק ב-cursor.com/automations או לחץ ↻
        </p>
      ) : null}

      <ol className="space-y-1.5 border-t border-black/[0.05] pt-3">
        {progress.stages.map((stage, index) => {
          const time = stage.state === "pending" || stage.state === "skipped" ? null : formatTime(stage.at)
          return (
            <li key={stage.id} className="flex items-center gap-2 text-xs">
              <span className={`relative h-2.5 w-2.5 shrink-0 rounded-full ${dotClass[stage.state]}`}>
                {stage.state === "active" ? (
                  <span className="qa-pulse absolute inset-0 rounded-full bg-sky-400/40" />
                ) : null}
              </span>
              <span className="w-4 shrink-0 tabular-nums text-[10px] text-muted-foreground">
                {index + 1}
              </span>
              <span className={labelClass[stage.state]}>{stage.label}</span>
              {time ? (
                <span className="ms-auto tabular-nums text-[10px] text-muted-foreground">{time}</span>
              ) : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
