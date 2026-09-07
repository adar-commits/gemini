import { getAgentSupabase } from "@/lib/agents/supabase"

/**
 * GOKU questions inbox — knowledge gaps found in real conversations become
 * questions the owner answers on /dashboard/goku. Answered questions are
 * injected into the live system prompt as verified owner facts.
 */

export type GokuQuestionRow = {
  id: string
  question: string
  status: "open" | "answered" | "dismissed"
  answer: string | null
  source_conversation_id: string | null
  answered_at: string | null
  created_at: string
}

const MAX_ANSWERS_IN_PROMPT = 30
const MAX_ANSWERS_CHARS = 4000
const CACHE_MS = 60_000

let cachedSection: { at: number; value: string } | null = null

function normalizeQuestion(text: string) {
  return text.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 300)
}

export async function insertGokuQuestions(input: {
  questions: string[]
  sourceConversationId?: string | null
  sourceReportId?: string | null
}) {
  const supabase = getAgentSupabase()
  let inserted = 0

  for (const raw of input.questions) {
    const question = raw.trim()
    if (question.length < 8 || question.length > 500) continue

    const { error } = await supabase.from("hom_agent_goku_questions").insert({
      question,
      normalized_question: normalizeQuestion(question),
      source_conversation_id: input.sourceConversationId ?? null,
      source_report_id: input.sourceReportId ?? null,
      status: "open",
    })

    if (error) {
      if (error.code === "23505") continue // duplicate question — already tracked
      throw error
    }
    inserted += 1
  }

  return inserted
}

export async function listGokuQuestions(status?: "open" | "answered" | "dismissed") {
  const supabase = getAgentSupabase()
  let query = supabase
    .from("hom_agent_goku_questions")
    .select("id, question, status, answer, source_conversation_id, answered_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100)

  if (status) query = query.eq("status", status)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as GokuQuestionRow[]
}

export async function answerGokuQuestion(input: {
  questionId: string
  answer: string
}) {
  const answer = input.answer.trim()
  if (!answer) throw new Error("Answer must not be empty")

  const supabase = getAgentSupabase()
  const { error } = await supabase
    .from("hom_agent_goku_questions")
    .update({
      answer,
      status: "answered",
      answered_at: new Date().toISOString(),
    })
    .eq("id", input.questionId)

  if (error) throw error
  cachedSection = null
  return { ok: true }
}

export async function dismissGokuQuestion(questionId: string) {
  const supabase = getAgentSupabase()
  const { error } = await supabase
    .from("hom_agent_goku_questions")
    .update({ status: "dismissed" })
    .eq("id", questionId)

  if (error) throw error
  return { ok: true }
}

/**
 * Owner-verified Q&A block for the system prompt — newest answers win the cap.
 * These are business facts confirmed by the owner; they outrank KB marketing copy.
 */
export async function ownerAnswersSection(): Promise<string> {
  if (cachedSection && Date.now() - cachedSection.at < CACHE_MS) {
    return cachedSection.value
  }

  let rows: GokuQuestionRow[]
  try {
    const supabase = getAgentSupabase()
    const { data, error } = await supabase
      .from("hom_agent_goku_questions")
      .select("question, answer, answered_at")
      .eq("status", "answered")
      .not("answer", "is", null)
      .order("answered_at", { ascending: false })
      .limit(MAX_ANSWERS_IN_PROMPT)
    if (error) throw error
    rows = (data ?? []) as GokuQuestionRow[]
  } catch {
    return ""
  }

  const lines: string[] = []
  let chars = 0
  for (const row of rows) {
    const answer = row.answer?.trim()
    if (!answer) continue
    const line = `- Q: ${row.question.trim()}\n  A: ${answer}`
    if (chars + line.length > MAX_ANSWERS_CHARS) break
    lines.push(line)
    chars += line.length
  }

  const value = lines.length
    ? `### OWNER ANSWERS (verified business facts — trust these over general knowledge)\n${lines.join("\n")}`
    : ""
  cachedSection = { at: Date.now(), value }
  return value
}
