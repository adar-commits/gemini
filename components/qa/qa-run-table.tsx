import type { QaAutomationRunRow } from "@/lib/agents/qa-automation-log"
import { QaRunCard } from "@/components/qa/qa-run-card"
import type { QaConversationContext } from "@/lib/landbot/qa-conversation-context"

export function QaRunTable({
  runs,
  siblingsBySession = new Map<string, QaAutomationRunRow[]>(),
  conversationContexts = new Map<string, QaConversationContext>(),
}: {
  runs: QaAutomationRunRow[]
  siblingsBySession?: Map<string, QaAutomationRunRow[]>
  conversationContexts?: Map<string, QaConversationContext>
}) {
  if (!runs.length) {
    return (
      <div className="qa-fade-up rounded-3xl border border-dashed border-slate-300/60 bg-white/60 px-6 py-16 text-center backdrop-blur-sm">
        <p className="text-lg font-semibold text-slate-800">אין אירועים בקטגוריה זו</p>
        <p className="mt-1 text-sm text-slate-600">
          הוסיפו מזהה שיחה למעלה, או המתינו ל-handoff / never-stuck מ-production
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {runs.map((run, index) => (
        <QaRunCard
          key={run.id}
          run={run}
          index={index}
          siblings={siblingsBySession.get(run.session_id) ?? []}
          conversation={conversationContexts.get(run.session_id) ?? null}
        />
      ))}
    </div>
  )
}
