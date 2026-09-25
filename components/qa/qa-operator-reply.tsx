"use client"

import { useState, useTransition } from "react"
import { replyToQaRunAction } from "@/app/dashboard/qa/actions"

const REPLY_MAX = 2000

const timeFormat = new Intl.DateTimeFormat("he-IL", {
  timeZone: "Asia/Jerusalem",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

export function QaOperatorReply({
  runId,
  questions,
  previousReplies,
}: {
  runId: string
  questions: string[]
  previousReplies: { at: string; text: string }[]
}) {
  const [reply, setReply] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    const text = reply.trim()
    if (!text) return
    setError(null)
    startTransition(async () => {
      const result = await replyToQaRunAction(runId, text)
      if (result.ok) {
        setReply("")
        return
      }
      setError(
        result.error === "not_waiting_for_operator"
          ? "האירוע כבר לא ממתין לתשובה — רענן את הדף"
          : result.error
      )
    })
  }

  return (
    <section className="rounded-2xl bg-gradient-to-l from-amber-50 to-transparent p-4 ring-1 ring-amber-200">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-900">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100 text-xs">?</span>
        האוטומציה ממתינה לתשובה שלך
      </h3>

      {questions.length ? (
        <ol className="mb-3 list-decimal space-y-1.5 ps-5 text-sm leading-relaxed text-amber-950/85">
          {questions.map((question) => (
            <li key={question.slice(0, 60)} className="whitespace-pre-wrap">
              {question}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mb-3 text-sm text-amber-950/75">
          ענו על מה שמופיע ב&quot;הבעיה&quot; / &quot;הפתרון&quot; — אשרו, תקנו או כתבו מה לעשות.
        </p>
      )}

      {previousReplies.length ? (
        <ul className="mb-3 space-y-1.5 border-t border-amber-200/70 pt-3">
          {previousReplies.map((item) => (
            <li key={item.at} className="text-xs text-amber-950/70">
              <span className="font-semibold text-amber-900">
                {timeFormat.format(Date.parse(item.at))} · התשובה שלך:
              </span>{" "}
              <span className="whitespace-pre-wrap">{item.text}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
        className="space-y-2"
      >
        <textarea
          rows={2}
          maxLength={REPLY_MAX}
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submit()
          }}
          disabled={pending}
          placeholder="התשובה שלך לאוטומציה — למשל: בשישי שירות הלקוחות סגור לגמרי, תעדכן את ההודעה"
          className="field-sizing-content max-h-48 min-h-[3.5rem] w-full resize-y rounded-xl border border-amber-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-500/20 disabled:opacity-60"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-amber-900/60">
            ⌘/Ctrl+Enter לשליחה · {reply.length}/{REPLY_MAX}
          </span>
          <button
            type="submit"
            disabled={pending || !reply.trim()}
            className="rounded-xl bg-gradient-to-l from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-amber-500/25 transition hover:from-amber-400 hover:to-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "שולח…" : "שלח תשובה לאוטומציה"}
          </button>
        </div>
        {error ? (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs text-rose-800 ring-1 ring-rose-100">
            {error}
          </p>
        ) : null}
      </form>
    </section>
  )
}
