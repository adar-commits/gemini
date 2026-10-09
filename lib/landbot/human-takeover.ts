import {
  classifyHumanThreadAge,
  type HumanThreadAgeTier,
} from "@/lib/agents/human-thread-age"
import {
  clearHumanAgentActivity,
  getHistory,
  getHumanTakeoverState,
  getLastLiveHumanOutboundAt,
  isLiveHumanLastOutbound,
  markHumanAgentActivity,
} from "@/lib/agents/memory"
import { isPostHumanHandoff } from "@/lib/agents/post-handoff"
import { findCrmConversation } from "@/lib/crm/conversation-lookup"
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

export type HumanThreadAssist = {
  owned: boolean
  mode: HumanThreadAgeTier | null
}

function laterIso(a?: string | null, b?: string | null) {
  const left = a?.trim() || ""
  const right = b?.trim() || ""
  if (!left) return right || null
  if (!right) return left
  return Date.parse(left) >= Date.parse(right) ? left : right
}

/**
 * Human owns the thread. Fresh → bot stays silent. After 4 staff hours
 * (bridge) or 2 staff days (stale) the bot may answer; the rep stays assigned.
 */
export function resolveHumanThreadAssistMode(input: {
  assignedAgentId?: number | null
  humanAgentLastAt?: string | null
  /** CRM assignment time — ages a thread whose rep never replied (508272038). */
  assignedAt?: string | null
  lastUserAt?: string | null
  now?: Date
}): HumanThreadAssist {
  void input.lastUserAt
  const owned =
    isAssignedToHumanAgent(input.assignedAgentId ?? null) ||
    Boolean(input.humanAgentLastAt?.trim())
  if (!owned) return { owned: false, mode: null }
  const last = input.humanAgentLastAt?.trim() || input.assignedAt?.trim()
  if (!last) return { owned: true, mode: "fresh" }
  return { owned: true, mode: classifyHumanThreadAge(last, input.now) }
}

/**
 * Bot must stay silent only while a human still owns a *fresh* thread.
 * Bridge/stale threads stay assigned to the rep but the bot may speak.
 */
export function shouldDeferToHumanAgent(input: {
  assignedAgentId?: number | null
  humanAgentLastAt?: string | null
  lastUserAt?: string | null
  now?: Date
}) {
  return resolveHumanThreadAssistMode(input).mode === "fresh"
}

/**
 * Inactivity ping + close stays off only while the rep is actively on the thread (fresh).
 * Bridge/stale threads where the bot is answering get the normal routine so they do not
 * sit open in the rep's queue (532876329 / 534098184). Cases a rep must act on end in
 * `human_service`, which skips the routine on its own.
 */
export function blocksInactivityRoutine(assist: HumanThreadAssist) {
  return assist.owned && assist.mode === "fresh"
}

async function resolveEffectiveAssignment(
  conversationId: string,
  assignedAgentId?: number | null
): Promise<{ agentId: number | null; assignedAt: string | null }> {
  if (isAssignedToHumanAgent(assignedAgentId ?? null)) {
    return { agentId: assignedAgentId ?? null, assignedAt: null }
  }
  const row = await findCrmConversation(conversationId).catch(() => null)
  const crmAgentId = Number(row?.assigned_agent_code)
  if (isAssignedToHumanAgent(crmAgentId)) {
    return { agentId: crmAgentId, assignedAt: row?.assigned_at ?? null }
  }
  return { agentId: assignedAgentId ?? null, assignedAt: null }
}

export async function resolveEffectiveAssignedAgentId(
  conversationId: string,
  assignedAgentId?: number | null
) {
  return (await resolveEffectiveAssignment(conversationId, assignedAgentId)).agentId
}

export async function resolveHumanThreadAssist(
  conversationId: string,
  assignedAgentId?: number | null,
  now = new Date()
): Promise<HumanThreadAssist> {
  const { agentId: effectiveAssignedAgentId, assignedAt } = await resolveEffectiveAssignment(
    conversationId,
    assignedAgentId
  )
  const state = await getHumanTakeoverState(conversationId)
  const lastOutboundAt = await getLastLiveHumanOutboundAt(conversationId).catch(() => null)
  const humanAgentLastAt = laterIso(state?.human_agent_last_at ?? null, lastOutboundAt)

  let assist = resolveHumanThreadAssistMode({
    assignedAgentId: effectiveAssignedAgentId,
    humanAgentLastAt,
    assignedAt,
    lastUserAt: state?.last_user_at ?? null,
    now,
  })

  if (
    assist.mode === "fresh" &&
    state?.human_agent_last_at &&
    !isAssignedToHumanAgent(effectiveAssignedAgentId ?? null) &&
    effectiveAssignedAgentId != null &&
    effectiveAssignedAgentId > 0 &&
    isLandbotApiAgentId(effectiveAssignedAgentId)
  ) {
    const history = await getHistory(conversationId).catch(() => [])
    if (!isPostHumanHandoff(null, history)) {
      await releaseHumanThread(conversationId)
      assist = { owned: false, mode: null }
    }
  }

  if (assist.mode === "fresh" && (await isLiveHumanLastOutbound(conversationId))) {
    try {
      await recordHumanAgentActivity(conversationId)
    } catch {
      // CRM fallback still silences the bot even if session upsert fails.
    }
    return { owned: true, mode: "fresh" }
  }

  return assist
}

export async function isHumanThreadActive(
  conversationId: string,
  assignedAgentId?: number | null
) {
  const assist = await resolveHumanThreadAssist(conversationId, assignedAgentId)
  return assist.mode === "fresh"
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
