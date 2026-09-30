"use client"

import { useEffect } from "react"

export default function QaDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[qa-dashboard]", error)
  }, [error])

  return (
    <div className="mx-auto max-w-xl px-5 py-16">
      <div className="rounded-3xl bg-white p-6 shadow-lg ring-1 ring-black/[0.06]">
        <h1 className="text-lg font-bold text-slate-900">שגיאה בטעינת QA</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          הדשבורד נפל בעת טעינה או רענון. זה יכול לקרות אחרי ↻ או בדיקה ידנית אם השרת
          לא הספיק להשיב.
        </p>
        <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 font-mono text-xs text-rose-800 ring-1 ring-rose-100">
          {error.message || "unknown error"}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            נסה שוב
          </button>
          <a
            href="/dashboard/qa"
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200"
          >
            חזרה ל-QA
          </a>
        </div>
      </div>
    </div>
  )
}
