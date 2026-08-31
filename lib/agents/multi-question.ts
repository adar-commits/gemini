import { generateText, jsonSchema, Output } from "ai"
import { specialistConfig } from "@/lib/agent-core/config"
import { recordTokenUsage } from "@/lib/agent-core/token-usage"
import { buildModelMessages } from "@/lib/agents/multimodal"
import { getSystemPrompt } from "@/lib/agents/prompts"
import { buildBranchReplyForText, isBranchListQuestion } from "@/lib/agents/branches"
import {
  isInventoryQuestion,
  resolveBranchInventoryReply,
} from "@/lib/agents/inventory-lookup"
import { hasEmbeddedBusinessAsk } from "@/lib/agents/compound-reply"
import {
  isDigitalDocumentRequest,
  isDocumentChannelQuestionPending,
  isDocumentTypeQuestionPending,
  isDocumentPhoneLookupPending,
} from "@/lib/agents/digital-document-flow"
import { isHumanHandoffPending } from "@/lib/agents/off-topic"
import {
  isOrderConfirmationPending,
  isPhoneLookupConfirmPending,
} from "@/lib/agents/order-lookup"
import { isRefundTimelineQuestion } from "@/lib/agents/inquiry-intent"
import {
  buildBranchReviewLinkReply,
  isBranchReviewLinkRequest,
} from "@/lib/agents/feedback-handling"
import {
  buildCarpetRentalPolicyReply,
  buildRefundTimelinePolicyReply,
  resolveReturnExchangePolicyReply,
  matchPolicySubjects,
  type PolicySubjectId,
} from "@/lib/agents/policy-subjects"
import {
  buildShippingPolicyReply,
  isShippingPolicyQuestion,
  isShippingStatusQuestion,
} from "@/lib/agents/shipping"
import { isDissatisfactionWithoutDefect, buildDissatisfactionRescueReply } from "@/lib/agents/dissatisfaction"
import { isSalesConsultationTrigger, isConfirmationPending } from "@/lib/agents/sales-intake"
import { CUSTOMER_HEADER } from "@/lib/agents/types"
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

function structuredFlowPrimaryHint(
  history: HistoryMessage[],
  questions: string[]
): string | null {
  if (isConfirmationPending(history) || isHumanHandoffPending(history)) {
    const answer = questions.find((q) =>
      /^(?:כן|לא|yes|no)(?:[\s,.!?]|$)/i.test(q.trim())
    )
    if (answer) return answer
  }
  if (
    isDocumentPhoneLookupPending(history) ||
    isPhoneLookupConfirmPending(history) ||
    isOrderConfirmationPending(history)
  ) {
    const phone = questions.find((q) => /[\d\-]{9,}/.test(q))
    if (phone) return phone
    const short = questions.find((q) => /^(?:כן|לא)\b/i.test(q.trim()))
    if (short) return short
  }
  if (isDocumentTypeQuestionPending(history)) {
    const typeAnswer = questions.find((q) =>
      /^(?:[123]|קבלה|חשבונית)/i.test(q.trim())
    )
    if (typeAnswer) return typeAnswer
  }
  if (isDocumentChannelQuestionPending(history)) {
    const channel = questions.find((q) =>
      /מלאי|אתר|סניף|online|website|מהאתר|מהסניף/i.test(q)
    )
    if (channel) return channel
  }
  return null
}

function questionPriority(question: string) {
  const text = question.trim()
  if (isDigitalDocumentRequest(text) || isShippingStatusQuestion(text)) return 0
  if (isSalesConsultationTrigger(text) || /רוצה\s+לקנות|מחפש(?:ים|ת|ים)?/i.test(text)) return 1
  return 2
}

export function pickPrimaryQuestion(questions: string[], history: HistoryMessage[]) {
  if (questions.length === 0) return null
  if (questions.length === 1) return questions[0]!

  const flowHint = structuredFlowPrimaryHint(history, questions)
  if (flowHint) return flowHint

  const sorted = [...questions].sort(
    (a, b) => questionPriority(a) - questionPriority(b)
  )
  return sorted[0]!
}

export function orderQuestionsByPriority(
  questions: string[],
  history: HistoryMessage[]
) {
  const primary = pickPrimaryQuestion(questions, history)
  if (!primary) return questions
  return [primary, ...questions.filter((q) => q !== primary)]
}

function dedupeReplyParts(parts: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of parts) {
    const normalized = part.replace(/\s+/g, " ").trim().toLowerCase()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(part)
  }
  return out
}

function stripCustomerHeader(text: string) {
  return text
    .replace(/^(?:\*הום בוט :\)\*\n?)+/g, "")
    .replace(new RegExp(`^${CUSTOMER_HEADER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n?`), "")
    .trim()
}

export function combineMultiQuestionReply(parts: string[]) {
  const body = dedupeReplyParts(
    parts.map(stripCustomerHeader).filter(Boolean)
  )
    .join("\n\n")
    .trim()
  if (!body) return ""
  return `${CUSTOMER_HEADER}\n${body}`
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

  recordTokenUsage({
    conversationId,
    purpose: "split",
    agent: "faq",
    model,
    usage: result.usage,
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
  if (isRefundTimelineQuestion(text)) return buildRefundTimelinePolicyReply()
  if (isBranchReviewLinkRequest(text)) return buildBranchReviewLinkReply(text)
  if (subjects.includes("returns_exchanges")) return resolveReturnExchangePolicyReply(text)
  if (isShippingPolicyQuestion(text) || subjects.includes("shipping_policy")) {
    return buildShippingPolicyReply()
  }
  if (isInventoryQuestion(text)) return null
  if (isBranchListQuestion(text) || subjects.includes("branches")) {
    return buildBranchReplyForText(text)
  }

  return null
}

const FAQ_REPLY_SCHEMA = jsonSchema<{ reply: string }>({
  type: "object",
  additionalProperties: false,
  required: ["reply"],
  properties: {
    reply: { type: "string" },
  },
})

const FAQ_BATCH_SCHEMA = jsonSchema<{ reply: string }>({
  type: "object",
  additionalProperties: false,
  required: ["reply"],
  properties: {
    reply: { type: "string" },
  },
})

async function answerFaqQuestionsWithLlmBatch(
  questions: string[],
  input: {
    conversationId: string
    history: HistoryMessage[]
    sessionSummary?: string | null
  }
) {
  if (questions.length === 0) return ""

  const inference = specialistConfig("faq")
  const model = inference.model()
  const numbered = questions.map((q, i) => `${i + 1}. ${q}`).join("\n")

  let system = getSystemPrompt("faq", questions.join(" | "))
  if (input.sessionSummary?.trim()) {
    system += `\n\n### CONVERSATION SUMMARY (internal)\n${input.sessionSummary.trim()}\n`
  }
  system += `\n\nAnswer ALL numbered customer questions below in ONE warm Hebrew WhatsApp message.
Use short paragraphs separated by blank lines. Cover every question. No header prefix in the reply body.`

  const result = await generateText({
    model,
    system,
    messages: buildModelMessages(input.history, { text: numbered, media: [] }),
    temperature: inference.temperature,
    maxOutputTokens: Math.min(inference.maxOutputTokens, 700),
    output: Output.object({
      name: "faq_combined_answer",
      description: "Combined FAQ answer for multiple questions",
      schema: FAQ_BATCH_SCHEMA,
    }),
  })

  recordTokenUsage({
    conversationId: input.conversationId,
    purpose: "faq",
    agent: "faq",
    model,
    usage: result.usage,
  })

  return result.output.reply.trim()
}

/** Resolve multi-question turns into one combined customer-facing reply (max 1 FAQ LLM call). */
export async function answerCombinedQuestions(
  questions: string[],
  input: {
    conversationId: string
    history: HistoryMessage[]
    sessionSummary?: string | null
  }
) {
  const ordered = orderQuestionsByPriority(questions, input.history)
  const parts: string[] = []
  const llmNeeded: string[] = []

  for (const question of ordered) {
    const deterministic = answerFaqQuestionDeterministic(question)
    if (deterministic) {
      parts.push(stripCustomerHeader(deterministic))
      continue
    }
    if (isInventoryQuestion(question)) {
      parts.push(
        stripCustomerHeader(
          await resolveBranchInventoryReply({ body: question, history: input.history })
        )
      )
      continue
    }
    llmNeeded.push(question)
  }

  if (llmNeeded.length > 0) {
    const batchReply = await answerFaqQuestionsWithLlmBatch(llmNeeded, input)
    if (batchReply) parts.push(stripCustomerHeader(batchReply))
  }

  return combineMultiQuestionReply(parts)
}

/** @deprecated Prefer answerCombinedQuestions for customer turns. */
export async function answerOrderedQuestions(
  questions: string[],
  input: {
    conversationId: string
    history: HistoryMessage[]
    runFaqLlm: (question: string) => Promise<string>
  }
) {
  const combined = await answerCombinedQuestions(questions, {
    conversationId: input.conversationId,
    history: input.history,
  })
  return combined ? [combined] : []
}

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

  recordTokenUsage({
    conversationId: input.conversationId,
    purpose: "faq",
    agent: "faq",
    model,
    usage: result.usage,
  })

  return result.output.reply.trim()
}
