import {
  clearHumanAgentActivity,
  getHumanTakeoverState,
  markHumanAgentActivity,
} from "@/lib/agents/memory"
import { pickHumanAgentId } from "@/lib/landbot/human-agents"

function parseAgentIds(raw: string | undefined) {
  if (!raw?.trim()) return []
  return raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isFinite(id) && id > 0)
}

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

/** Landbot assigned the customer to a live rep (not the API bot). */
export function isAssignedToHumanAgent(assignedAgentId: number | null | undefined) {
  return isConfiguredHumanAgentId(assignedAgentId)
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
  return shouldDeferToHumanAgent({
    assignedAgentId,
    humanAgentLastAt: state?.human_agent_last_at ?? null,
    lastUserAt: state?.last_user_at ?? null,
  })
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
