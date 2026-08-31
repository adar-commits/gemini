/** v3 single-agent engine is default; set AGENT_ENGINE=v2 to rollback. */
export function usesHomAgentV3() {
  const raw = process.env.AGENT_ENGINE?.trim().toLowerCase()
  return raw !== "v2"
}
