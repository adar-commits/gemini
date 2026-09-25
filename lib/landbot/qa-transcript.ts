import { getAgentSupabase } from "@/lib/agents/supabase"
import { safeConversationLookupId } from "@/lib/crm/conversation-lookup"

const DEFAULT_MAX_CHARS = 14_000
const NO_WINDOW_MESSAGE_LIMIT = 40
const MIN_WINDOW_MESSAGES = 3

function clip(value: unknown, max: number) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim()
  return text.length <= max ? text : `${text.slice(0, max)}…`
}

export async function resolveQaSessionIds(conversationId: string) {
  const lookupId = safeConversationLookupId(conversationId)
  if (!lookupId) return null
  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("conversations")
    .select("session_id, landbot_customer_id, conversation_ref")
    .or(
      `landbot_customer_id.eq.${lookupId},session_id.eq.${lookupId},conversation_ref.eq.${lookupId}`
    )
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return Array.from(
    new Set(
      [lookupId, data?.session_id, data?.landbot_customer_id, data?.conversation_ref]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  )
}

/**
 * Event-window timeline + agent turns + shadow logs as plain text, so the QA automation can
 * analyze straight from the webhook payload without installing deps or holding DB secrets.
 * Oldest timeline lines are dropped first when over maxChars.
 */
export async function buildQaTranscript(input: {
  conversationId: string
  since: string | null
  maxChars?: number
  /** No window and no 80-message cap (operator --full-thread reads only). */
  fullThread?: boolean
}) {
  const sessionIds = await resolveQaSessionIds(input.conversationId)
  if (!sessionIds?.length) return null
  const supabase = getAgentSupabase()
  const maxChars = input.maxChars ?? DEFAULT_MAX_CHARS

  let since = input.since
  if (since) {
    // CRM reopen can move opened_at past the incident — an empty window would hide the bug.
    const { count, error } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .in("session_id", sessionIds)
      .gte("sent_at", since)
    if (error) throw error
    if ((count ?? 0) < MIN_WINDOW_MESSAGES) since = null
  }

  const newestOnly = !since && !input.fullThread
  let messageQuery = supabase
    .from("messages")
    .select("sent_at, direction, sender_type, body")
    .in("session_id", sessionIds)
    .not("body", "is", null)
    .order("sent_at", { ascending: !newestOnly })
  if (since) messageQuery = messageQuery.gte("sent_at", since)
  if (newestOnly) messageQuery = messageQuery.limit(NO_WINDOW_MESSAGE_LIMIT)

  let agentQuery = supabase
    .from("hom_agent_messages")
    .select("created_at, role, action, agent, content")
    .in("conversation_id", sessionIds)
    .order("created_at", { ascending: !newestOnly })
    .limit(40)
  if (since) agentQuery = agentQuery.gte("created_at", since)

  let shadowQuery = supabase
    .from("hom_agent_shadow_logs")
    .select("created_at, action, llm_calls, routing_path, fallback_layer, user_text, draft_reply")
    .in("conversation_id", sessionIds)
    .order("created_at", { ascending: !newestOnly })
    .limit(20)
  if (since) shadowQuery = shadowQuery.gte("created_at", since)

  const [messages, agentTurns, shadow] = await Promise.all([
    messageQuery,
    agentQuery,
    shadowQuery,
  ])
  if (messages.error) throw messages.error
  if (agentTurns.error) throw agentTurns.error
  if (shadow.error) throw shadow.error

  const chronological = <T>(rows: T[] | null) =>
    newestOnly ? [...(rows ?? [])].reverse() : rows ?? []
  const messageRows = chronological(messages.data)
  const timeline = messageRows.map((row) => {
    const who =
      row.direction === "incoming" || row.sender_type === "customer" ? "customer" : "bot"
    return `[${row.sent_at}] ${who}: ${clip(row.body, 700)}`
  })

  const agentLines = chronological(agentTurns.data).map(
    (row) =>
      `[${row.created_at}] ${row.role} action=${row.action ?? "-"} agent=${row.agent ?? "-"}: ${clip(row.content, 400)}`
  )

  const shadowLines = chronological(shadow.data).flatMap((row) => [
    `[${row.created_at}] action=${row.action ?? "-"} llm=${row.llm_calls ?? "-"} path=${row.routing_path ?? "-"} fallback=${row.fallback_layer ?? "-"}`,
    `  user: ${clip(row.user_text, 240)}`,
    `  draft: ${clip(row.draft_reply, 240)}`,
  ])

  const tail = [
    agentLines.length ? `\nAGENT TURNS\n${agentLines.join("\n")}` : "",
    shadowLines.length ? `\nSHADOW\n${shadowLines.join("\n")}` : "",
  ].join("")

  const budget = Math.max(2_000, maxChars - tail.length)
  const kept: string[] = []
  let used = 0
  for (let i = timeline.length - 1; i >= 0; i -= 1) {
    const line = timeline[i]!
    if (used + line.length + 1 > budget) break
    kept.unshift(line)
    used += line.length + 1
  }
  const omitted = timeline.length - kept.length
  const header = omitted ? `(${omitted} earlier messages omitted)\n` : ""

  return `TIMELINE\n${header}${kept.join("\n")}${tail}`.slice(0, maxChars + 200)
}
