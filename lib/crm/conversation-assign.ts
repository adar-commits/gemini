import { findCrmConversation } from "@/lib/crm/conversation-lookup"
import { getAgentSupabase } from "@/lib/agents/supabase"
import {
  HOM_CRM_BOT_AGENT_CODE,
  HOM_CRM_BOT_AGENT_NAME,
  isLandbotApiAgentId,
} from "@/lib/landbot/api-agent-ids"

export function crmHomBotAssignEnabled() {
  return process.env.CRM_HOM_BOT_ASSIGN?.trim() !== "false"
}

/** Claim CRM inbox as HomGroup Bot — never steal a live human assignment. */
export function crmHomBotAssignDecision(
  assignedAgentCode: string | null | undefined
): "claim" | "unchanged" | "human_assigned" {
  const current = String(assignedAgentCode ?? "").trim()
  if (!current) return "claim"
  if (current === HOM_CRM_BOT_AGENT_CODE) return "unchanged"
  const asNumber = Number(current)
  if (Number.isFinite(asNumber) && isLandbotApiAgentId(asNumber)) return "claim"
  return "human_assigned"
}

export function shouldClaimCrmHomBotAssignment(
  assignedAgentCode: string | null | undefined
) {
  return crmHomBotAssignDecision(assignedAgentCode) === "claim"
}

export type AssignCrmHomBotResult =
  | {
      ok: true
      updated: true
      sessionId: string
      previousAgentCode: string | null
    }
  | {
      ok: true
      updated: false
      reason: "disabled" | "not_found" | "unchanged" | "human_assigned"
    }

/**
 * Inbox assign for the bot — Landbot assignToApiAgent does not write conversations.
 * Message hooks often unassign 279136; persist HomGroup Bot after we reply.
 */
export async function assignCrmConversationToHomBot(input: {
  conversationId: string
}): Promise<AssignCrmHomBotResult> {
  if (!crmHomBotAssignEnabled()) {
    return { ok: true, updated: false, reason: "disabled" }
  }

  const row = await findCrmConversation(input.conversationId)
  if (!row?.session_id) {
    console.warn("[crm-assign] conversation not found", input.conversationId)
    return { ok: true, updated: false, reason: "not_found" }
  }

  const previousAgentCode =
    typeof row.assigned_agent_code === "string"
      ? row.assigned_agent_code.trim()
      : null
  const decision = crmHomBotAssignDecision(previousAgentCode)
  if (decision !== "claim") {
    return { ok: true, updated: false, reason: decision }
  }

  const supabase = getAgentSupabase()
  const now = new Date().toISOString()
  const { error: updateError } = await supabase
    .from("conversations")
    .update({
      assigned_agent_code: HOM_CRM_BOT_AGENT_CODE,
      assigned_at: now,
      updated_at: now,
    })
    .eq("session_id", row.session_id)

  if (updateError) throw updateError

  const { error: logError } = await supabase.from("conversation_status_log").insert({
    session_id: row.session_id,
    action_type: "agent_assigned",
    old_value: previousAgentCode || "ללא שיוך",
    new_value: HOM_CRM_BOT_AGENT_NAME,
    source: "hom_bot",
    changed_at: now,
    payload: {
      next_agent_code: HOM_CRM_BOT_AGENT_CODE,
      previous_agent_code: previousAgentCode,
      landbot_customer_id: row.landbot_customer_id ?? input.conversationId,
    },
  })

  if (logError) {
    console.warn("[crm-assign] audit log failed", row.session_id, logError.message)
  }

  return {
    ok: true,
    updated: true,
    sessionId: row.session_id,
    previousAgentCode,
  }
}
