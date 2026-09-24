"use client"

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import type { QaAutomationOutcome } from "@/lib/agents/qa-automation-log"
import { updateQaRunOutcomeAction } from "@/app/dashboard/qa/actions"

export function QaRunActions({
  runId,
  outcome,
}: {
  runId: string
  outcome: QaAutomationOutcome
}) {
  const [pending, startTransition] = useTransition()

  function mark(next: QaAutomationOutcome) {
    startTransition(async () => {
      await updateQaRunOutcomeAction({ id: runId, outcome: next })
    })
  }

  if (outcome === "implemented" || outcome === "vanished") return null

  return (
    <div className="flex shrink-0 flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => mark("ignored")}
        className="text-xs"
      >
        סמן התעלמות
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => mark("false_alarm")}
        className="text-xs"
      >
        אזעקת שווא
      </Button>
    </div>
  )
}
