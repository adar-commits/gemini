"use server"

import { revalidatePath } from "next/cache"
import { approveGokuSuggestion } from "@/lib/agents/goku-trainer"

export async function approveGokuSuggestionAction(input: {
  reportId: string
  suggestionId: string
}) {
  const result = await approveGokuSuggestion({
    reportId: input.reportId,
    suggestionId: input.suggestionId,
  })
  revalidatePath("/dashboard/goku")
  return result
}
