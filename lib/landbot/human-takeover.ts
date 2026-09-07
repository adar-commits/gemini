import {
  clearHumanAgentActivity,
  getHumanTakeoverState,
  isLiveHumanLastOutbound,
  markHumanAgentActivity,
} from "@/lib/agents/memory"
import { isLandbotApiAgentId, landbotApiAgentIds } from "@/lib/landbot/api-agent-ids"
import { pickHumanAgentId } from "@/lib/landbot/human-agents"

function parseAgentIds(raw: string | undefined) {
  if (!raw?.trim()) return []
  return raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isFinite(id) && id > 0)
}

export { BUILTIN_LANDBOT_API_AGENT_IDS } from "@/lib/landbot/api-agent-ids"
export { landbotApiAgentIds, isLandbotApiAgentId } from "@/lib/landbot/api-agent-ids"

export function configuredHumanAgentIds() {
  return Array.from(
    new Set([
      ...parseAgentIds(process.env.LANDBOT_HUMAN_AGENT_SALES_IDS),
      ...parseAgentIds(process.env.LANDBOT_HUMAN_AGENT_SERVICE_IDS),
    ])
  )
}

export function isConfiguredHumanAgentId(agentId: number | null | undefined) {
  if (!agentId || !Number.isFinite(agentId) || agentId <= 0) return false
  return configuredHumanAgentIds().includes(agentId)
}

export function isLandbotApiAgentSender(agentName?: string | null) {
  return /^API$/i.test(String(agentName ?? "").trim())
}

/** Outbound from Landbot API automation — not a live human rep. */
export function isLandbotApiAgent(input: {
  agentId?: number | null
  agentName?: string | null
}) {
  if (isLandbotApiAgentSender(input.agentName)) return true
  return isLandbotApiAgentId(input.agentId ?? null)
}

/** A live human rep sent a message or was assigned — bot must stay silent. */
export function isLiveHumanLandbotAgent(input: {
  agentId?: number | null
  agentName?: string | null
}) {
  if (isLandbotApiAgent(input)) return false
  if (input.agentId && input.agentId > 0) return true
  return Boolean(input.agentName?.trim())
}

export function shouldRecordHumanAgentActivity(input: {
  agentId?: number | null
  agentName?: string | null
}) {
  return isLiveHumanLandbotAgent(input)
}

/** Landbot assigned the customer to a live rep (not the API bot). */
export function isAssignedToHumanAgent(assignedAgentId: number | null | undefined) {
  if (!assignedAgentId || assignedAgentId <= 0) return false
  if (isConfiguredHumanAgentId(assignedAgentId)) return true
  if (landbotApiAgentIds().length > 0) {
    return !isLandbotApiAgentId(assignedAgentId)
  }
  return false
}

/**
 * Bot must stay silent when a human owns the thread:
 * - customer is assigned to a configured human agent, or
 * - a human agent has participated since the last bot reclaim/unassign.
 */
export function shouldDeferToHumanAgent(input: {
  assignedAgentId?: number | null
  humanAgentLastAt?: string | null
  lastUserAt?: string | null
}) {
  void input.lastUserAt
  if (isAssignedToHumanAgent(input.assignedAgentId ?? null)) return true
  return Boolean(input.humanAgentLastAt?.trim())
}

export async function isHumanThreadActive(
  conversationId: string,
  assignedAgentId?: number | null
) {
  const state = await getHumanTakeoverState(conversationId)
  let defer = shouldDeferToHumanAgent({
    assignedAgentId,
    humanAgentLastAt: state?.human_agent_last_at ?? null,
    lastUserAt: state?.last_user_at ?? null,
  })

  if (
    defer &&
    state?.human_agent_last_at &&
    !isAssignedToHumanAgent(assignedAgentId ?? null) &&
    assignedAgentId != null &&
    assignedAgentId > 0 &&
    isLandbotApiAgentId(assignedAgentId)
  ) {
    await releaseHumanThread(conversationId)
    defer = false
  }

  if (defer) return true

  if (await isLiveHumanLastOutbound(conversationId)) {
    try {
      await recordHumanAgentActivity(conversationId)
    } catch {
      // CRM fallback still silences the bot even if session upsert fails.
    }
    return true
  }

  return false
}

export async function recordHumanAgentActivity(conversationId: string) {
  await markHumanAgentActivity(conversationId)
}

export async function releaseHumanThread(conversationId: string) {
  await clearHumanAgentActivity(conversationId)
}

export function humanAgentIdForHandoff(
  action: "human_sales" | "human_service",
  customerId: number
) {
  return pickHumanAgentId(action, customerId)
}
