"use client"

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts"

type Segment = { key: string; label: string; value: number; color: string }

export function QaHealthGauge({
  score,
  segments,
  total,
}: {
  score: number
  segments: Segment[]
  total: number
}) {
  const data = segments.length
    ? segments
    : [{ key: "empty", label: "אין נתונים", value: 1, color: "#e4e4e7" }]

  return (
    <div className="relative mx-auto h-44 w-44">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={58}
            outerRadius={78}
            paddingAngle={segments.length > 1 ? 3 : 0}
            stroke="none"
            animationBegin={0}
            animationDuration={900}
          >
            {data.map((entry) => (
              <Cell key={entry.key} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-bold tabular-nums tracking-tight text-white">
          {score}%
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-indigo-200/80">
          הצלחת יישום
        </span>
        <span className="mt-0.5 text-[11px] text-indigo-200/60">{total} אירועים</span>
      </div>
    </div>
  )
}
