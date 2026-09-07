"use server"

import { revalidatePath } from "next/cache"
import { approveGokuSuggestion } from "@/lib/agents/goku-trainer"
import {
  answerGokuQuestion,
  dismissGokuQuestion,
} from "@/lib/agents/goku-questions"

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

export async function answerGokuQuestionAction(formData: FormData) {
  const questionId = String(formData.get("questionId") ?? "").trim()
  const answer = String(formData.get("answer") ?? "").trim()
  if (!questionId || !answer) return

  try {
    await answerGokuQuestion({ questionId, answer })
    revalidatePath("/dashboard/goku")
  } catch (error) {
    console.error("[goku-questions] answer failed", error)
  }
}

export async function dismissGokuQuestionAction(formData: FormData) {
  const questionId = String(formData.get("questionId") ?? "").trim()
  if (!questionId) return

  try {
    await dismissGokuQuestion(questionId)
    revalidatePath("/dashboard/goku")
  } catch (error) {
    console.error("[goku-questions] dismiss failed", error)
  }
}
