import { generateText, jsonSchema, Output } from "ai"
import { specialistConfig } from "@/lib/agent-core/config"
import { recordLlmCall } from "@/lib/agent-core/turn-metrics"
import { buildModelMessages } from "@/lib/agents/multimodal"
import { getSystemPrompt } from "@/lib/agents/prompts"
import { buildBranchReplyForText, isBranchListQuestion } from "@/lib/agents/branches"
import {
  isBranchInventoryQuestion,
  resolveBranchInventoryReply,
} from "@/lib/agents/inventory-lookup"
import { hasEmbeddedBusinessAsk } from "@/lib/agents/compound-reply"
import {
  buildCarpetRentalPolicyReply,
  buildReturnExchangePolicyReply,
  matchPolicySubjects,
  type PolicySubjectId,
} from "@/lib/agents/policy-subjects"
import { buildShippingPolicyReply, isShippingPolicyQuestion } from "@/lib/agents/shipping"
import { isDissatisfactionWithoutDefect, buildDissatisfactionRescueReply } from "@/lib/agents/dissatisfaction"
import type { HistoryMessage } from "@/lib/agents/types"

const SPLIT_SCHEMA = jsonSchema<{ questions: string[] }>({
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 4,
    },
  },
})

export function looksLikeMultipleQuestions(body: string) {
  const text = body.trim()
  if (!text) return false

  const marks = (text.match(/\?/g) ?? []).length
  if (marks >= 2) return true

  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length >= 2 && lines.some((line) => /\?/.test(line) || hasEmbeddedBusinessAsk(line))) {
    return true
  }

  const subjects = distinctPolicySubjects(text)
  if (subjects.length >= 2) return true

  return false
}

function distinctPolicySubjects(text: string): PolicySubjectId[] {
  const parts = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (parts.length <= 1) return matchPolicySubjects(text)

  const found = new Set<PolicySubjectId>()
  for (const part of parts) {
    for (const subject of matchPolicySubjects(part)) found.add(subject)
  }
  return [...found]
}

function splitByNewlines(body: string) {
  return body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 8 && (/\?/.test(line) || hasEmbeddedBusinessAsk(line)))
}

function splitByQuestionMarks(body: string) {
  const chunks = body
    .split(/(?<=\?)\s*/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length >= 8)
  return chunks.length >= 2 ? chunks : []
}

export async function splitOrderedQuestions(
  body: string,
  conversationId: string
): Promise<string[]> {
  const text = body.trim()
  if (!text) return []

  const byLines = splitByNewlines(text)
  if (byLines.length >= 2) return byLines

  const byMarks = splitByQuestionMarks(text)
  if (byMarks.length >= 2) return byMarks

  const subjects = distinctPolicySubjects(text)
  if (subjects.length >= 2) {
    const parts: string[] = []
    for (const line of text.split(/\n+/).map((l) => l.trim()).filter(Boolean)) {
      if (matchPolicySubjects(line).length > 0) parts.push(line)
    }
    if (parts.length >= 2) return parts
  }

  if (!looksLikeMultipleQuestions(text)) return [text]

  const inference = specialistConfig("faq")
  const model = inference.model()
  recordLlmCall(conversationId, model)

  const result = await generateText({
    model,
    temperature: 0.1,
    maxOutputTokens: 256,
    system: `You split a Hebrew customer WhatsApp message into separate questions, in the order asked.
Return JSON only. Each item must be one complete question (include enough context to answer alone).
Do not merge unrelated questions. Do not invent questions.`,
    prompt: text,
    output: Output.object({
      name: "split_questions",
      description: "Ordered list of distinct customer questions",
      schema: SPLIT_SCHEMA,
    }),
  })

  const questions = result.output.questions
    .map((q) => q.trim())
    .filter((q) => q.length >= 6)
  return questions.length >= 2 ? questions : [text]
}

export function answerFaqQuestionDeterministic(question: string) {
  const text = question.trim()
  if (!text) return null

  if (isDissatisfactionWithoutDefect(text)) {
    return buildDissatisfactionRescueReply()
  }

  const subjects = matchPolicySubjects(text)
  if (subjects.includes("carpet_rental")) return buildCarpetRentalPolicyReply()
  if (subjects.includes("returns_exchanges")) return buildReturnExchangePolicyReply()
  if (isShippingPolicyQuestion(text) || subjects.includes("shipping_policy")) {
    return buildShippingPolicyReply()
  }
  if (isBranchInventoryQuestion(text)) return null
  if (isBranchListQuestion(text) || subjects.includes("branches")) {
    return buildBranchReplyForText(text)
  }

  return null
}

export async function answerOrderedQuestions(
  questions: string[],
  input: {
    conversationId: string
    history: HistoryMessage[]
    runFaqLlm: (question: string) => Promise<string>
  }
) {
  const replies: string[] = []

  for (const question of questions) {
    const deterministic = answerFaqQuestionDeterministic(question)
    if (deterministic) {
      replies.push(deterministic)
      continue
    }
    if (isBranchInventoryQuestion(question)) {
      replies.push(await resolveBranchInventoryReply({ body: question, history: input.history }))
      continue
    }
    replies.push(await input.runFaqLlm(question))
  }

  return replies.filter(Boolean)
}

const FAQ_REPLY_SCHEMA = jsonSchema<{ reply: string }>({
  type: "object",
  additionalProperties: false,
  required: ["reply"],
  properties: {
    reply: { type: "string" },
  },
})

export async function answerFaqQuestionWithLlm(
  question: string,
  input: {
    conversationId: string
    history: HistoryMessage[]
    sessionSummary?: string | null
  }
) {
  const inference = specialistConfig("faq")
  const model = inference.model()
  recordLlmCall(input.conversationId, model)

  let system = getSystemPrompt("faq", question)
  if (input.sessionSummary?.trim()) {
    system += `\n\n### CONVERSATION SUMMARY (internal)\n${input.sessionSummary.trim()}\n`
  }
  system +=
    "\n\nAnswer ONLY this one customer question. One concise Hebrew reply — no header prefix."

  const result = await generateText({
    model,
    system,
    messages: buildModelMessages(input.history, { text: question, media: [] }),
    temperature: inference.temperature,
    maxOutputTokens: Math.min(inference.maxOutputTokens, 400),
    output: Output.object({
      name: "faq_single_answer",
      description: "Single FAQ answer",
      schema: FAQ_REPLY_SCHEMA,
    }),
  })

  return result.output.reply.trim()
}
