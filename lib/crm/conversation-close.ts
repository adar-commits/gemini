import { findCrmConversation } from "@/lib/crm/conversation-lookup"
import { getAgentSupabase } from "@/lib/agents/supabase"

export function crmCloseSyncEnabled() {
  return process.env.CRM_CLOSE_SYNC?.trim() !== "false"
}

export type CloseCrmConversationResult =
  | { ok: true; updated: true; sessionId: string }
  | { ok: true; updated: false; reason: "disabled" | "not_found" | "already_closed" }

/**
 * Close the inquiry in the CRM inbox (conversations.closed_at) — not Landbot-only.
 */
export async function closeCrmConversation(input: {
  conversationId: string
  reason?: string
}): Promise<CloseCrmConversationResult> {
  if (!crmCloseSyncEnabled()) {
    return { ok: true, updated: false, reason: "disabled" }
  }

  const row = await findCrmConversation(input.conversationId)
  if (!row?.session_id) {
    console.warn("[crm-close] conversation not found", input.conversationId)
    return { ok: true, updated: false, reason: "not_found" }
  }

  if (row.closed_at) {
    return { ok: true, updated: false, reason: "already_closed" }
  }

  const supabase = getAgentSupabase()
  const now = new Date().toISOString()
  const reason = input.reason?.trim() || "inactivity_close"

  const { error: updateError } = await supabase
    .from("conversations")
    .update({
      closed_at: now,
      updated_at: now,
    })
    .eq("session_id", row.session_id)

  if (updateError) throw updateError

  const { error: logError } = await supabase.from("conversation_status_log").insert({
    session_id: row.session_id,
    action_type: "status_closed",
    old_value: "פתוח",
    new_value: "סגור",
    source: "hom_bot",
    changed_at: now,
    payload: {
      reason,
      landbot_customer_id: row.landbot_customer_id ?? input.conversationId,
    },
  })

  if (logError) {
    console.warn("[crm-close] audit log failed", row.session_id, logError.message)
  }

  return { ok: true, updated: true, sessionId: row.session_id }
}
