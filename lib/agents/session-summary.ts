import { generateText } from "ai"
import { routerConfig } from "@/lib/agent-core/config"
import { NO_THINKING_PROVIDER_OPTIONS } from "@/lib/agent-core/model-profiles"
import { recordTokenUsage } from "@/lib/agent-core/token-usage"
import type { ConversationVisit } from "@/lib/agents/conversation-visit"
import { formatHebrewCustomerDate, formatHebrewCustomerDateTime } from "@/lib/agents/hebrew-date-format"
import { getAgentSupabase } from "@/lib/agents/supabase"
import type { HistoryMessage } from "@/lib/agents/types"

const SUMMARY_EVERY_TURNS = 5
/** Hebrew is token-heavy — 200 cut summaries mid-word (228989877). */
const SUMMARY_MAX_OUTPUT_TOKENS = 700

const SUMMARY_INSTRUCTIONS = `You keep the internal memory note of a Hebrew WhatsApp customer-service bot for HoM GROUP (rugs and carpets, Israel).
Write the note in Hebrew, plain text, no markdown, at most 130 words, exactly these lines:
בקשה נוכחית: what the customer wants right now — their latest messages win over older ones; a new topic replaces the old one.
מה כבר נעשה: lookups done and their results (order numbers, status), answers given, transfers to a rep.
ממתין ל: the open question the bot is waiting on, or "אין".
פרטים: exact phones, order numbers, products, sizes, names the customer gave.
רקע קודם: one short line about topics from a past visit or already closed, or "אין".
Never invent facts. Never present a past-visit topic as the current request.`

export async function getConversationSummary(conversationId: string) {
  const supabase = getAgentSupabase()
  const { data } = await supabase
    .from("hom_agent_sessions")
    .select("conversation_summary")
    .eq("conversation_id", conversationId)
    .maybeSingle()
  const text = data?.conversation_summary
  return typeof text === "string" && text.trim() ? text.trim() : null
}

/** A summary written before this turn opened a new visit is background, not the current request. */
export function summaryForPrompt(summary: string | null, visit: ConversationVisit | null) {
  const text = summary?.trim()
  if (!text) return null
  if (visit?.fresh) {
    return `(נכתב בביקור קודם, לפני ${visit.gapDays} ימים — רקע בלבד, לא הבקשה הנוכחית)\n${text}`
  }
  return text
}

function visitNote(visit: ConversationVisit | null | undefined) {
  if (!visit) return ""
  const previous = formatHebrewCustomerDate(visit.previousVisitAt) ?? "earlier"
  return !visit.fresh && visit.anchor
    ? `Visit boundary: the current visit started with the customer message «${visit.anchor}» after ${visit.gapDays} days of silence. Everything before it is a past visit (ended ${previous}).\n\n`
    : `Visit boundary: the latest customer message opens a new visit after ${visit.gapDays} days of silence. Everything before it is a past visit (ended ${previous}).\n\n`
}

export async function maybeRefreshConversationSummary(input: {
  conversationId: string
  history: HistoryMessage[]
  /** Current customer message — history is loaded before the turn. */
  body?: string
  reply?: string
  visit?: ConversationVisit | null
}) {
  const turn: HistoryMessage[] = [
    ...(input.body?.trim() ? [{ role: "user" as const, content: input.body.trim() }] : []),
    ...(input.reply?.trim() ? [{ role: "assistant" as const, content: input.reply.trim() }] : []),
  ]
  const thread = [...input.history, ...turn]
  const userTurns = thread.filter((m) => m.role === "user").length
  const opensNewVisit = Boolean(input.visit?.fresh)
  if (userTurns === 0) return
  if (!opensNewVisit && userTurns % SUMMARY_EVERY_TURNS !== 0) return

  const transcript = thread
    .slice(-26)
    .map((m) => `${m.role === "user" ? "לקוח" : "בוט"}: ${m.content}`)
    .join("\n")

  try {
    const model = routerConfig().model()
    const result = await generateText({
      model,
      system: SUMMARY_INSTRUCTIONS,
      prompt: `${visitNote(input.visit)}Thread (oldest → newest):\n${transcript}`,
      maxOutputTokens: SUMMARY_MAX_OUTPUT_TOKENS,
      temperature: 0.1,
      providerOptions: NO_THINKING_PROVIDER_OPTIONS,
    })

    recordTokenUsage({
      conversationId: input.conversationId,
      purpose: "summary",
      agent: "master",
      model,
      usage: result.usage,
    })

    const summary = result.text?.trim()
    if (!summary) return

    const stamp = formatHebrewCustomerDateTime(new Date().toISOString())
    const supabase = getAgentSupabase()
    await supabase.from("hom_agent_sessions").upsert({
      conversation_id: input.conversationId,
      conversation_summary: stamp ? `עודכן ${stamp}\n${summary}` : summary,
      updated_at: new Date().toISOString(),
    })
  } catch {
    // non-blocking
  }
}
