import { gokuGradeTo100, gokuGradeTone } from "@/lib/agents/goku-trainer"
import { cn } from "@/lib/utils"

export function GokuGradeRing({ grade }: { grade: number }) {
  const score = gokuGradeTo100(grade)
  const tone = gokuGradeTone(score)
  const stroke =
    tone === "good"
      ? "#059669"
      : tone === "ok"
        ? "#d97706"
        : "#dc2626"

  const radius = 36
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference

  return (
    <div className="relative flex h-24 w-24 items-center justify-center">
      <svg className="-rotate-90" width="96" height="96" viewBox="0 0 96 96">
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted"
        />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            "text-2xl font-bold tabular-nums",
            tone === "good" && "text-emerald-600",
            tone === "ok" && "text-amber-600",
            tone === "poor" && "text-red-600"
          )}
        >
          {score}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          / 100
        </span>
      </div>
    </div>
  )
}
