"use client"

import { useEffect, useState } from "react"
import { formatQaElapsedHebrew, qaRunElapsedMs } from "@/lib/agents/qa-run-display"

export function QaElapsedTimer({
  sinceIso,
  className = "",
  live = true,
}: {
  sinceIso: string
  className?: string
  live?: boolean
}) {
  const [label, setLabel] = useState(() =>
    formatQaElapsedHebrew(qaRunElapsedMs(sinceIso))
  )

  useEffect(() => {
    if (!live) return
    const tick = () => setLabel(formatQaElapsedHebrew(qaRunElapsedMs(sinceIso)))
    tick()
    const id = window.setInterval(tick, 30_000)
    return () => window.clearInterval(id)
  }, [sinceIso, live])

  return (
    <span className={className} title="זמן שחל מאז העדכון האחרון">
      {label}
    </span>
  )
}
