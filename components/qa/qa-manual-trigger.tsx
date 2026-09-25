"use client"

import { useState, useTransition } from "react"
import { createManualQaEventAction } from "@/app/dashboard/qa/actions"

export function QaManualTrigger({ disabled }: { disabled?: boolean }) {
  const [sessionId, setSessionId] = useState("")
  const [notes, setNotes] = useState("")
  const [feedback, setFeedback] = useState<{
    tone: "ok" | "error"
    text: string
  } | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const id = sessionId.trim()
    if (!id) return

    setFeedback(null)
    startTransition(async () => {
      const result = await createManualQaEventAction(id, notes.trim() || undefined)
      if (result.ok) {
        setFeedback({
          tone: "ok",
          text: `נשלח לאוטומציה — אירוע חדש לשיחה #${result.sessionId}${notes.trim() ? " (כולל ההערות שלך)" : ""}`,
        })
        setSessionId("")
        setNotes("")
        return
      }

      const messages: Record<string, string> = {
        invalid_id: "הזינו מזהה שיחה תקין",
        not_found: "לא נמצאה שיחה עם המזהה הזה ב-CRM",
        disabled: "מערכת QA לא מוגדרת (חסר webhook)",
        webhook_failed: result.detail ?? "שליחת webhook לניתוח נכשלה",
      }
      setFeedback({
        tone: "error",
        text: messages[result.reason] ?? result.reason,
      })
    })
  }

  return (
    <section className="qa-fade-up rounded-3xl bg-white/95 p-5 shadow-[0_8px_40px_-12px_rgba(15,23,42,0.15)] ring-1 ring-black/[0.06] backdrop-blur-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">בדיקה ידנית</h2>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            הזינו מזהה שיחה (session / Landbot ID) — ניצור אירוע, נשלח
            לאוטומציה ונתחיל את תהליך הבדיקה. הערות שתכתבו יגיעו לאוטומציה
            כתיאור הבעיה שלכם.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-end"
      >
        <label className="min-w-0">
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">
            מזהה שיחה
          </span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            placeholder="לדוגמה 532360395"
            value={sessionId}
            onChange={(event) => setSessionId(event.target.value)}
            disabled={disabled || pending}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 shadow-sm outline-none ring-indigo-500/0 transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
          />
        </label>
        <label className="min-w-0">
          <span className="mb-1.5 flex items-baseline justify-between text-xs font-semibold text-slate-700">
            הערות לאוטומציה
            <span className="font-normal text-slate-400">אופציונלי · {notes.length}/2000</span>
          </span>
          <textarea
            rows={1}
            maxLength={2000}
            placeholder="מה השתבש? למשל: הבוט העביר למכירות במקום לשירות אחרי שאישרתי הזמנה"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={disabled || pending}
            className="field-sizing-content max-h-40 min-h-[2.75rem] w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
          />
        </label>
        <button
          type="submit"
          disabled={disabled || pending || !sessionId.trim()}
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-l from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "שולח…" : "התחל בדיקה"}
        </button>
      </form>

      {feedback ? (
        <p
          role="status"
          className={
            feedback.tone === "ok"
              ? "mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-100"
              : "mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-100"
          }
        >
          {feedback.text}
        </p>
      ) : null}
    </section>
  )
}
