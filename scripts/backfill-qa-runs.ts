/**
 * Backfill hom_agent_qa_runs from today's handoffs + never-stuck messages.
 *
 * Usage: npx tsx scripts/backfill-qa-runs.ts [--days 1]
 */
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { buildBotFailureIdempotencyKey, buildHomServiceConversationUrl } from "../lib/landbot/cursor-automation-qa"
import { insertQaAutomationRun } from "../lib/agents/qa-automation-log"
import { getAgentSupabase } from "../lib/agents/supabase"

function loadEnvFile(relativePath: string) {
  const path = join(process.cwd(), relativePath)
  if (!existsSync(path)) return
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq)
    if (process.env[key]?.trim()) continue
    let value = trimmed.slice(eq + 1)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (value) process.env[key] = value
  }
}

function arg(name: string) {
  const idx = process.argv.indexOf(name)
  return idx >= 0 ? process.argv[idx + 1]?.trim() : ""
}

async function resolveSession(conversationId: string) {
  const supabase = getAgentSupabase()
  const lookupId = conversationId.trim()
  const { data } = await supabase
    .from("conversations")
    .select("session_id, landbot_customer_id")
    .or(
      `landbot_customer_id.eq.${lookupId},session_id.eq.${lookupId},conversation_ref.eq.${lookupId}`
    )
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return {
    sessionId: data?.session_id?.trim() || lookupId,
    landbotCustomerId: data?.landbot_customer_id?.trim() || lookupId,
  }
}

async function main() {
  loadEnvFile(".env.production.local")
  loadEnvFile(".env.local")

  const days = Math.max(1, Number(arg("--days") || "1") || 1)
  const since = new Date(Date.now() - days * 86400000).toISOString()
  const supabase = getAgentSupabase()

  const { data: handoffs, error: handoffError } = await supabase
    .from("hom_agent_messages")
    .select("id, conversation_id, action, created_at")
    .in("action", ["human_service", "human_sales"])
    .gte("created_at", since)
    .order("created_at", { ascending: false })

  if (handoffError) throw handoffError

  const { data: neverStuck, error: neverStuckError } = await supabase
    .from("hom_agent_messages")
    .select("id, conversation_id, content, created_at")
    .eq("role", "assistant")
    .ilike("content", "%לא הצלחתי להבין את ההודעה%")
    .gte("created_at", since)
    .order("created_at", { ascending: false })

  if (neverStuckError) throw neverStuckError

  let inserted = 0
  let skipped = 0

  for (const row of handoffs ?? []) {
    const { sessionId, landbotCustomerId } = await resolveSession(row.conversation_id)
    try {
      await insertQaAutomationRun({
        sessionId,
        landbotCustomerId,
        conversationUrl: buildHomServiceConversationUrl(sessionId),
        trigger: "human_assign",
        phase: "analyze",
        outcome: "triggered",
        rootCause: `Backfill: human handoff (${row.action}) — awaiting automation analyze`,
        idempotencyKey: `backfill:${row.id}`,
        createdAt: row.created_at,
      })
      inserted += 1
    } catch (error) {
      if (error instanceof Error && error.message.includes("duplicate")) {
        skipped += 1
        continue
      }
      throw error
    }
  }

  for (const row of neverStuck ?? []) {
    const { sessionId, landbotCustomerId } = await resolveSession(row.conversation_id)

    const { data: lastUser } = await supabase
      .from("hom_agent_messages")
      .select("content")
      .eq("conversation_id", row.conversation_id)
      .eq("role", "user")
      .lte("created_at", row.created_at)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    const lastUserMessage = lastUser?.content ?? ""
    try {
      await insertQaAutomationRun({
        sessionId,
        landbotCustomerId,
        conversationUrl: buildHomServiceConversationUrl(sessionId),
        trigger: "bot_failure",
        phase: "analyze",
        outcome: "triggered",
        rootCause: "Backfill: never-stuck reply — awaiting automation analyze",
        idempotencyKey: `backfill:${row.id}`,
        operatorNotes: buildBotFailureIdempotencyKey(sessionId, lastUserMessage),
        createdAt: row.created_at,
      })
      inserted += 1
    } catch {
      skipped += 1
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        days,
        handoffs: handoffs?.length ?? 0,
        neverStuck: neverStuck?.length ?? 0,
        inserted,
        skipped,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
