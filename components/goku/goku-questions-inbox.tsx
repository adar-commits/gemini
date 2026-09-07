import type { GokuQuestionRow } from "@/lib/agents/goku-questions"
import {
  answerGokuQuestionAction,
  dismissGokuQuestionAction,
} from "@/app/dashboard/goku/actions"

function formatDate(iso: string | null) {
  if (!iso) return ""
  try {
    return new Date(iso).toLocaleString("he-IL", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return ""
  }
}

export function GokuQuestionsInbox({
  open,
  answered,
}: {
  open: GokuQuestionRow[]
  answered: GokuQuestionRow[]
}) {
  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.06]">
      <div className="border-b border-black/[0.05] px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">
          שאלות מהשטח
          {open.length > 0 ? (
            <span className="me-2 inline-flex size-5 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-800">
              {open.length}
            </span>
          ) : null}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          פערי ידע שזוהו בשיחות — תשובה נכנסת מיד לבוט
        </p>
      </div>

      {open.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">
          אין שאלות פתוחות
        </p>
      ) : (
        <ul className="divide-y divide-black/[0.05]">
          {open.map((question) => (
            <li key={question.id} className="px-5 py-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <p className="text-sm font-medium leading-relaxed">
                  {question.question}
                </p>
                <time className="shrink-0 text-[11px] text-muted-foreground">
                  {formatDate(question.created_at)}
                </time>
              </div>

              <form action={answerGokuQuestionAction} className="space-y-2.5">
                <input type="hidden" name="questionId" value={question.id} />
                <textarea
                  name="answer"
                  required
                  minLength={2}
                  rows={2}
                  placeholder="התשובה העסקית המדויקת…"
                  className="w-full resize-none rounded-xl border-0 bg-zinc-50 px-3.5 py-2.5 text-sm ring-1 ring-black/[0.06] placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
                  >
                    שמור
                  </button>
                </div>
              </form>

              <form action={dismissGokuQuestionAction} className="mt-2">
                <input type="hidden" name="questionId" value={question.id} />
                <button
                  type="submit"
                  className="rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-zinc-100 hover:text-foreground"
                >
                  לא רלוונטי — הסר שאלה
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {answered.length > 0 ? (
        <details className="border-t border-black/[0.05]">
          <summary className="cursor-pointer px-5 py-3 text-xs font-medium text-muted-foreground hover:text-foreground">
            נענו ({answered.length})
          </summary>
          <ul className="divide-y divide-black/[0.05] border-t border-black/[0.04] bg-zinc-50/50">
            {answered.map((question) => (
              <li key={question.id} className="px-5 py-3">
                <p className="text-sm font-medium">{question.question}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {question.answer}
                </p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  )
}
