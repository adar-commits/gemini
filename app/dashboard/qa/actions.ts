"use server"

import { revalidatePath } from "next/cache"
import {
  deleteQaAutomationRun,
  updateQaAutomationRun,
  type QaAutomationOutcome,
} from "@/lib/agents/qa-automation-log"
import { retryQaAutomationRun } from "@/lib/landbot/qa-run-retry"

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

export async function deleteQaRunAction(id: string) {
  await deleteQaAutomationRun(id)
  revalidatePath("/dashboard/qa")
}

export async function retryQaRunAction(id: string) {
  const result = await retryQaAutomationRun(id)
  revalidatePath("/dashboard/qa")
  return result
}
