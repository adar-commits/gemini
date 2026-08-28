import { generateText } from "ai"
import { routerConfig } from "@/lib/agent-core/config"
import { recordTokenUsage } from "@/lib/agent-core/token-usage"
import { getAgentSupabase } from "@/lib/agents/supabase"
import type { HistoryMessage } from "@/lib/agents/types"

const SUMMARY_EVERY_TURNS = 8

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

export async function maybeRefreshConversationSummary(input: {
  conversationId: string
  history: HistoryMessage[]
}) {
  const userTurns = input.history.filter((m) => m.role === "user").length
  if (userTurns === 0 || userTurns % SUMMARY_EVERY_TURNS !== 0) return

  const transcript = input.history
    .slice(-24)
    .map((m) => `${m.role === "user" ? "לקוח" : "בוט"}: ${m.content}`)
    .join("\n")

  try {
    const result = await generateText({
      model: routerConfig().model(),
      prompt: `Summarize this Hebrew WhatsApp thread for an internal bot context. Include: customer intent, collected facts, open questions, emotional tone. Max 120 words Hebrew.\n\n${transcript}`,
      maxOutputTokens: 200,
      temperature: 0.1,
    })

    recordTokenUsage({
      conversationId: input.conversationId,
      purpose: "summary",
      agent: "master",
      model: routerConfig().model(),
      usage: result.usage,
    })

    const summary = result.text?.trim()
    if (!summary) return

    const supabase = getAgentSupabase()
    await supabase.from("hom_agent_sessions").upsert({
      conversation_id: input.conversationId,
      conversation_summary: summary,
      updated_at: new Date().toISOString(),
    })
  } catch {
    // non-blocking
  }
}
