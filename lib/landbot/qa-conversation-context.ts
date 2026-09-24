import { getAgentSupabase } from "@/lib/agents/supabase"
import { safeConversationLookupId } from "@/lib/crm/conversation-lookup"

export type QaConversationContext = {
  sessionId: string
  landbotCustomerId: string | null
  customerName: string | null
  messageCount: number | null
  phone: string | null
  department: string | null
  inquiryType: string | null
  lastUserMessage: string | null
  lastBotReply: string | null
}

function clipBody(text: string, max: number) {
  return text.trim().replace(/\s+/g, " ").slice(0, max)
}

async function fetchLastMessages(sessionIds: string[]) {
  if (!sessionIds.length) {
    return { lastUserMessage: null, lastBotReply: null }
  }

  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("messages")
    .select("direction, sender_type, body")
    .in("session_id", sessionIds)
    .not("body", "is", null)
    .order("sent_at", { ascending: false })
    .limit(40)

  if (error) throw error

  let lastUserMessage: string | null = null
  let lastBotReply: string | null = null
  for (const row of data ?? []) {
    const isCustomer =
      row.direction === "incoming" || row.sender_type === "customer"
    const body = clipBody(String(row.body ?? ""), 500)
    if (!body) continue
    if (isCustomer && !lastUserMessage) lastUserMessage = body
    if (!isCustomer && !lastBotReply) lastBotReply = body
    if (lastUserMessage && lastBotReply) break
  }

  return { lastUserMessage, lastBotReply }
}

function mapConversationRow(
  row: Record<string, unknown>,
  last: { lastUserMessage: string | null; lastBotReply: string | null }
): QaConversationContext | null {
  const sessionId =
    typeof row.session_id === "string" ? row.session_id.trim() : ""
  if (!sessionId) return null

  return {
    sessionId,
    landbotCustomerId:
      typeof row.landbot_customer_id === "string"
        ? row.landbot_customer_id.trim() || null
        : null,
    customerName:
      typeof row.customer_name === "string"
        ? row.customer_name.trim() || null
        : null,
    messageCount:
      typeof row.message_count === "number" ? row.message_count : null,
    phone:
      typeof row.phone_e164 === "string" ? row.phone_e164.trim() || null : null,
    department:
      typeof row.department === "string" ? row.department.trim() || null : null,
    inquiryType:
      typeof row.inquiry_type === "string"
        ? row.inquiry_type.trim() || null
        : null,
    ...last,
  }
}

export async function resolveQaConversationContext(
  conversationId: string
): Promise<QaConversationContext | null> {
  const lookupId = safeConversationLookupId(conversationId)
  if (!lookupId) return null

  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "session_id, landbot_customer_id, conversation_ref, customer_name, message_count, phone_e164, department, inquiry_type"
    )
    .or(
      `landbot_customer_id.eq.${lookupId},session_id.eq.${lookupId},conversation_ref.eq.${lookupId}`
    )
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const sessionIds = Array.from(
    new Set(
      [
        lookupId,
        data.session_id,
        data.landbot_customer_id,
        data.conversation_ref,
      ]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  )
  const last = await fetchLastMessages(sessionIds)
  return mapConversationRow(data as Record<string, unknown>, last)
}

export async function listQaConversationContexts(
  sessionIds: string[]
): Promise<Map<string, QaConversationContext>> {
  const unique = Array.from(
    new Set(sessionIds.map((id) => id.trim()).filter(Boolean))
  )
  const map = new Map<string, QaConversationContext>()
  if (!unique.length) return map

  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "session_id, landbot_customer_id, customer_name, message_count, phone_e164, department, inquiry_type"
    )
    .in("session_id", unique)

  if (error) throw error

  for (const row of data ?? []) {
    const mapped = mapConversationRow(row as Record<string, unknown>, {
      lastUserMessage: null,
      lastBotReply: null,
    })
    if (mapped) map.set(mapped.sessionId, mapped)
  }

  return map
}
