function parseAgentIds(raw: string | undefined) {
  if (!raw?.trim()) return []
  return raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isFinite(id) && id > 0)
}

/** HoM bot's Landbot / CRM agent — conversations stay assigned here; not a human rep. */
export const BUILTIN_LANDBOT_API_AGENT_IDS = [279136] as const
export const HOM_CRM_BOT_AGENT_CODE = String(BUILTIN_LANDBOT_API_AGENT_IDS[0])
export const HOM_CRM_BOT_AGENT_NAME = "HomGroup Bot"

export function landbotApiAgentIds() {
  const fromEnv = parseAgentIds(process.env.LANDBOT_API_AGENT_IDS)
  return Array.from(new Set([...BUILTIN_LANDBOT_API_AGENT_IDS, ...fromEnv]))
}

export function isLandbotApiAgentId(agentId: number | null | undefined) {
  if (!agentId || !Number.isFinite(agentId) || agentId <= 0) return false
  return landbotApiAgentIds().includes(agentId)
}
