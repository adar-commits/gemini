function parseAgentIds(raw: string | undefined) {
  if (!raw?.trim()) return []
  return raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isFinite(id) && id > 0)
}

/** Stable pick so the same customer maps to the same rep within a team pool. */
export function pickHumanAgentId(
  action: "human_sales" | "human_service",
  customerId: number
) {
  const envKey =
    action === "human_sales"
      ? process.env.LANDBOT_HUMAN_AGENT_SALES_IDS
      : process.env.LANDBOT_HUMAN_AGENT_SERVICE_IDS

  const ids = parseAgentIds(envKey)
  if (!ids.length) return null
  return ids[Math.abs(customerId) % ids.length]!
}
