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
      month: "numeric",
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
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">
          שאלות פתוחות מהשטח ({open.length})
        </h2>
        <p className="text-sm text-muted-foreground">
          GOKU מזהה ידע שחסר לבוט בשיחות אמיתיות. כל תשובה שתשמרו נכנסת מיידית
          לידע החי של הבוט (ללא deploy).
        </p>
      </div>

      {open.length === 0 ? (
        <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
          אין שאלות פתוחות כרגע — GOKU יוסיף כאן שאלות כשיזהה פערי ידע.
        </div>
      ) : (
        <ul className="space-y-3">
          {open.map((question) => (
            <li key={question.id} className="rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{question.question}</p>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(question.created_at)}
                </span>
              </div>
              {question.source_conversation_id ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  מקור: שיחה {question.source_conversation_id}
                </p>
              ) : null}
              <form action={answerGokuQuestionAction} className="mt-3 space-y-2">
                <input type="hidden" name="questionId" value={question.id} />
                <textarea
                  name="answer"
                  required
                  minLength={2}
                  rows={2}
                  placeholder="כתבו כאן את התשובה העסקית המדויקת…"
                  className="w-full rounded-lg border bg-background p-2 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                  >
                    שמור תשובה
                  </button>
                  <button
                    type="submit"
                    formAction={dismissGokuQuestionAction}
                    className="rounded-lg border px-3 py-1.5 text-sm text-muted-foreground"
                  >
                    לא רלוונטי
                  </button>
                </div>
              </form>
            </li>
          ))}
        </ul>
      )}

      {answered.length > 0 ? (
        <details className="rounded-xl border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            נענו ({answered.length}) — פעילות בידע החי של הבוט
          </summary>
          <ul className="mt-3 space-y-2">
            {answered.map((question) => (
              <li key={question.id} className="rounded-lg bg-muted/30 p-3 text-sm">
                <p className="font-medium">{question.question}</p>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
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
