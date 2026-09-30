"use server"

import { revalidatePath } from "next/cache"
import {
  deleteQaAutomationRun,
  updateQaAutomationRun,
  type QaAutomationOutcome,
} from "@/lib/agents/qa-automation-log"
import { replyToQaAutomationRun, retryQaAutomationRun } from "@/lib/landbot/qa-run-retry"
import { triggerManualQaReview } from "@/lib/landbot/qa-manual-trigger"

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
  try {
    const result = await retryQaAutomationRun(id)
    revalidatePath("/dashboard/qa")
    return result
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "retry_failed",
    }
  }
}

export async function replyToQaRunAction(id: string, reply: string) {
  try {
    const result = await replyToQaAutomationRun(id, reply)
    revalidatePath("/dashboard/qa")
    return result
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "reply_failed",
    }
  }
}

export async function createManualQaEventAction(
  conversationId: string,
  operatorNotes?: string
) {
  try {
    const result = await triggerManualQaReview(conversationId, operatorNotes)
    revalidatePath("/dashboard/qa")
    return result
  } catch (error) {
    return {
      ok: false as const,
      reason: "server_error" as const,
      detail: error instanceof Error ? error.message : "create_failed",
    }
  }
}
