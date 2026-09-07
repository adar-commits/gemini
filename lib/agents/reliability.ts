import { getAgentSupabase } from "@/lib/agents/supabase"

type SnapshotOptions = { days?: number }

export type ReliabilitySnapshot = {
  windowDays: number
  generatedAt: string
  totals: {
    turns: number
    llmTurns: number
    handoffTurns: number
    handoffRate: number
    recoverTurns: number
    recoverRate: number
    repeatAssistantRate: number
    avgGokuGrade: number | null
    inputTokens: number
    outputTokens: number
  }
  routingPaths: Array<{ key: string; count: number }>
  modelsByTokens: Array<{ model: string; inputTokens: number; outputTokens: number }>
}

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function ratio(numerator: number, denominator: number) {
  if (!denominator) return 0
  return Math.round((numerator / denominator) * 1000) / 10
}

function countByKey(values: string[]) {
  const map = new Map<string, number>()
  for (const value of values) {
    if (!value) continue
    map.set(value, (map.get(value) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
}

export async function getReliabilitySnapshot(
  options: SnapshotOptions = {}
): Promise<ReliabilitySnapshot> {
  const windowDays = Math.max(1, Math.min(options.days ?? 7, 30))
  const since = isoDaysAgo(windowDays)
  const supabase = getAgentSupabase()

  const [shadowRes, tokenRes, reportRes, messageRes] = await Promise.all([
    supabase
      .from("hom_agent_shadow_logs")
      .select("conversation_id, action, llm_calls, routing_path")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(6000),
    supabase
      .from("hom_agent_token_usage")
      .select("model, input_tokens, output_tokens, routing_path")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(12000),
    supabase
      .from("hom_agent_goku_reports")
      .select("grade")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("hom_agent_messages")
      .select("conversation_id, role, content")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(12000),
  ])

  if (shadowRes.error) throw shadowRes.error
  if (tokenRes.error) throw tokenRes.error
  if (reportRes.error) throw reportRes.error
  if (messageRes.error) throw messageRes.error

  const shadowRows = shadowRes.data ?? []
  const tokenRows = tokenRes.data ?? []
  const reportRows = reportRes.data ?? []
  const messageRows = messageRes.data ?? []

  const turns = shadowRows.length
  const llmTurns = shadowRows.filter((row) => Number(row.llm_calls ?? 0) > 0).length
  const handoffTurns = shadowRows.filter(
    (row) => row.action === "human_service" || row.action === "human_sales"
  ).length
  const recoverTurns = shadowRows.filter((row) => row.routing_path === "v3_tool_recover").length

  const inputTokens = tokenRows.reduce(
    (sum, row) => sum + Math.max(0, Number(row.input_tokens ?? 0)),
    0
  )
  const outputTokens = tokenRows.reduce(
    (sum, row) => sum + Math.max(0, Number(row.output_tokens ?? 0)),
    0
  )

  const modelsMap = new Map<string, { inputTokens: number; outputTokens: number }>()
  for (const row of tokenRows) {
    const model = String(row.model ?? "").trim()
    if (!model) continue
    const stats = modelsMap.get(model) ?? { inputTokens: 0, outputTokens: 0 }
    stats.inputTokens += Math.max(0, Number(row.input_tokens ?? 0))
    stats.outputTokens += Math.max(0, Number(row.output_tokens ?? 0))
    modelsMap.set(model, stats)
  }
  const modelsByTokens = [...modelsMap.entries()]
    .map(([model, stats]) => ({ model, ...stats }))
    .sort((a, b) => b.inputTokens - a.inputTokens)
    .slice(0, 8)

  const avgGokuGrade =
    reportRows.length > 0
      ? Math.round(
          (reportRows.reduce((sum, row) => sum + Number(row.grade ?? 0), 0) /
            reportRows.length) *
            10
        ) / 10
      : null

  const repeatsByConversation = new Map<string, string>()
  let assistantPairs = 0
  let repeatedPairs = 0
  for (const row of messageRows) {
    if (row.role !== "assistant") continue
    const conversationId = String(row.conversation_id ?? "")
    if (!conversationId) continue
    const current = String(row.content ?? "").trim()
    if (!current) continue
    const previous = repeatsByConversation.get(conversationId)
    if (previous != null) {
      assistantPairs += 1
      if (previous === current) repeatedPairs += 1
    }
    repeatsByConversation.set(conversationId, current)
  }

  return {
    windowDays,
    generatedAt: new Date().toISOString(),
    totals: {
      turns,
      llmTurns,
      handoffTurns,
      handoffRate: ratio(handoffTurns, turns),
      recoverTurns,
      recoverRate: ratio(recoverTurns, turns),
      repeatAssistantRate: ratio(repeatedPairs, assistantPairs),
      avgGokuGrade,
      inputTokens,
      outputTokens,
    },
    routingPaths: countByKey(
      shadowRows.map((row) => String(row.routing_path ?? "").trim() || "unknown")
    ).slice(0, 8),
    modelsByTokens,
  }
}
