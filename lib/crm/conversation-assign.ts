import { findCrmConversation } from "@/lib/crm/conversation-lookup"
import { getAgentSupabase } from "@/lib/agents/supabase"
import {
  HOM_CRM_BOT_AGENT_CODE,
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

/** A live rep holds the inbox — not empty and not the HoM / Landbot API bot. */
export function crmHoldsHumanAssignment(assignedAgentCode: string | null | undefined) {
  const current = String(assignedAgentCode ?? "").trim()
  if (!current || current === HOM_CRM_BOT_AGENT_CODE) return false
  const asNumber = Number(current)
  if (Number.isFinite(asNumber) && isLandbotApiAgentId(asNumber)) return false
  return true
}

/**
 * Landbot webhooks and other external writers must not clear a human or
 * replace them with the API bot. Another human (dashboard / auto_assign) may.
 */
export function externalAssignmentWouldReplaceHuman(
  previousAgentCode: string | null | undefined,
  nextAgentCode: string | null | undefined
) {
  if (!crmHoldsHumanAssignment(previousAgentCode)) return false
  const next = String(nextAgentCode ?? "").trim()
  if (!next || next === HOM_CRM_BOT_AGENT_CODE) return true
  const asNumber = Number(next)
  return Number.isFinite(asNumber) && isLandbotApiAgentId(asNumber)
}

/** Ignore a Landbot assign/unassign when it disagrees with the human we stored. */
export function shouldIgnoreLandbotAssignmentEvent(input: {
  crmAgentCode: string | null | undefined
  action: "assign" | "unassign"
  eventAgentId: number | null
}) {
  if (!crmHoldsHumanAssignment(input.crmAgentCode)) return false
  if (input.action === "unassign") return true
  if (input.eventAgentId == null) return true
  return String(input.eventAgentId) !== String(input.crmAgentCode).trim()
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

  await writeCrmAgentAssignment({
    sessionId: row.session_id,
    nextAgentCode: HOM_CRM_BOT_AGENT_CODE,
    previousAgentCode,
    source: "hom_bot",
    landbotCustomerId: row.landbot_customer_id ?? input.conversationId,
  })

  return {
    ok: true,
    updated: true,
    sessionId: row.session_id,
    previousAgentCode,
  }
}

/**
 * Customer replied after a voice-closure template — reclaim CRM inbox for HoM bot even when
 * a human rep is still assigned (533657825).
 */
export async function assignCrmConversationToHomBotOnVoiceClosureReply(input: {
  conversationId: string
}): Promise<AssignCrmHomBotResult> {
  if (!crmHomBotAssignEnabled()) {
    return { ok: true, updated: false, reason: "disabled" }
  }

  const row = await findCrmConversation(input.conversationId)
  if (!row?.session_id) {
    console.warn("[crm-assign] voice-closure reply: conversation not found", input.conversationId)
    return { ok: true, updated: false, reason: "not_found" }
  }

  const previousAgentCode =
    typeof row.assigned_agent_code === "string"
      ? row.assigned_agent_code.trim()
      : null
  if (previousAgentCode === HOM_CRM_BOT_AGENT_CODE) {
    return { ok: true, updated: false, reason: "unchanged" }
  }

  await writeCrmAgentAssignment({
    sessionId: row.session_id,
    nextAgentCode: HOM_CRM_BOT_AGENT_CODE,
    previousAgentCode,
    source: "hom_bot_voice_closure_reply",
    landbotCustomerId: row.landbot_customer_id ?? input.conversationId,
  })

  return {
    ok: true,
    updated: true,
    sessionId: row.session_id,
    previousAgentCode,
  }
}

/**
 * Persist the rep we picked. Landbot assign is best-effort and must not be
 * the inbox source of truth — webhooks often replace this with the API bot.
 */
export async function assignCrmConversationToHumanAgent(input: {
  conversationId: string
  agentCode: string
}): Promise<AssignCrmHomBotResult> {
  const agentCode = input.agentCode.trim()
  if (!agentCode || agentCode === HOM_CRM_BOT_AGENT_CODE) {
    return { ok: true, updated: false, reason: "disabled" }
  }

  const row = await findCrmConversation(input.conversationId)
  if (!row?.session_id) {
    console.warn("[crm-assign] human assign: conversation not found", input.conversationId)
    return { ok: true, updated: false, reason: "not_found" }
  }

  const previousAgentCode =
    typeof row.assigned_agent_code === "string"
      ? row.assigned_agent_code.trim()
      : null
  if (previousAgentCode === agentCode) {
    return { ok: true, updated: false, reason: "unchanged" }
  }
  if (crmHoldsHumanAssignment(previousAgentCode)) {
    return { ok: true, updated: false, reason: "human_assigned" }
  }

  await writeCrmAgentAssignment({
    sessionId: row.session_id,
    nextAgentCode: agentCode,
    previousAgentCode,
    source: "hom_bot",
    landbotCustomerId: row.landbot_customer_id ?? input.conversationId,
  })

  return {
    ok: true,
    updated: true,
    sessionId: row.session_id,
    previousAgentCode,
  }
}

async function writeCrmAgentAssignment(input: {
  sessionId: string
  nextAgentCode: string
  previousAgentCode: string | null
  source: string
  landbotCustomerId: string | null
}) {
  const supabase = getAgentSupabase()
  const { error } = await supabase.rpc("assign_conversation_agent", {
    p_session_id: input.sessionId,
    p_agent_code: input.nextAgentCode,
    p_source: input.source,
    p_previous: input.previousAgentCode ?? "",
    p_landbot_customer_id: input.landbotCustomerId ?? "",
    p_action_type: "agent_assigned",
  })
  if (error) throw error
}
