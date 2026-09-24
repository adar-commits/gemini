"use client"

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts"

export function QaRiskGauge({ score }: { score: number | null }) {
  const value = score ?? 0
  const fill =
    value >= 8 ? "#f43f5e" : value >= 5 ? "#f59e0b" : value > 0 ? "#10b981" : "#d4d4d8"

  const data = [
    { name: "risk", value },
    { name: "rest", value: Math.max(0, 10 - value) },
  ]

  return (
    <div className="relative h-20 w-20 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            cx="50%"
            cy="50%"
            startAngle={180}
            endAngle={0}
            innerRadius={26}
            outerRadius={36}
            stroke="none"
            animationDuration={700}
          >
            <Cell fill={fill} />
            <Cell fill="#f4f4f5" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center">
        <span className="text-sm font-bold tabular-nums text-foreground">
          {score ?? "—"}
        </span>
        <span className="block text-[9px] text-muted-foreground">סיכון</span>
      </div>
    </div>
  )
}
