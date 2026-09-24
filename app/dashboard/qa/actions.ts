"use server"

import { revalidatePath } from "next/cache"
import {
  updateQaAutomationRun,
  type QaAutomationOutcome,
} from "@/lib/agents/qa-automation-log"

export async function updateQaRunOutcomeAction(input: {
  id: string
  outcome: QaAutomationOutcome
  operatorNotes?: string
}) {
  await updateQaAutomationRun({
    id: input.id,
    outcome: input.outcome,
    operatorNotes: input.operatorNotes,
  })
  revalidatePath("/dashboard/qa")
}
