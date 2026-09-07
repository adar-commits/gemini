import { gokuGradeTo100, gokuGradeTone } from "@/lib/agents/goku-trainer"
import { cn } from "@/lib/utils"

export function GokuGradeRing({
  grade,
  size = "md",
}: {
  grade: number
  size?: "sm" | "md"
}) {
  const score = gokuGradeTo100(grade)
  const tone = gokuGradeTone(score)
  const stroke =
    tone === "good" ? "#059669" : tone === "ok" ? "#d97706" : "#dc2626"

  const dim = size === "sm" ? 72 : 88
  const radius = size === "sm" ? 28 : 34
  const strokeWidth = size === "sm" ? 6 : 7
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference

  return (
    <div
      className="relative shrink-0"
      style={{ width: dim, height: dim }}
      aria-label={`ציון ${score} מתוך 100`}
    >
      <svg
        className="-rotate-90"
        width={dim}
        height={dim}
        viewBox={`0 0 ${dim} ${dim}`}
      >
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={radius}
          fill="none"
          stroke="#e4e4e7"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            "font-bold tabular-nums leading-none",
            size === "sm" ? "text-xl" : "text-2xl",
            tone === "good" && "text-emerald-600",
            tone === "ok" && "text-amber-600",
            tone === "poor" && "text-red-600"
          )}
        >
          {score}
        </span>
        <span className="mt-0.5 text-[10px] text-muted-foreground">/100</span>
      </div>
    </div>
  )
}
