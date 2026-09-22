/**
 * Print one HoM CRM thread for QA. Argument is the id from
 * https://service.hom-group.co.il/conversations/<id>
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { getAgentSupabase } from "@/lib/agents/supabase"

function loadEnvFile(name: string) {
  try {
    const text = readFileSync(resolve(process.cwd(), name), "utf8")
    for (const line of text.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // optional file
  }
}

loadEnvFile(".env.local")
loadEnvFile(".env.production.local")

for (const key of ["AGENT_SUPABASE_URL", "AGENT_SUPABASE_SERVICE_ROLE_KEY"]) {
  const value = process.env[key]?.trim().replace(/^["']|["']$/g, "")
  if (!value) delete process.env[key]
  else process.env[key] = value
}

if (!process.env.AGENT_SUPABASE_URL || !process.env.AGENT_SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing AGENT_SUPABASE_URL / AGENT_SUPABASE_SERVICE_ROLE_KEY. Query Landbot Supabase project walklyxhkhrdzbkfhtez via execute_sql instead."
  )
  process.exit(1)
}

const rawId = process.argv[2]?.trim() ?? ""
const id = rawId.replace(/[^\dA-Za-z_-]/g, "")
if (!id) {
  console.error("Usage: npx tsx scripts/read-hom-conversation.ts <conversation-id>")
  process.exit(1)
}

function clip(value: unknown, max = 700) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim()
  if (text.length <= max) return text
  return `${text.slice(0, max)}…`
}

async function main() {
  const supabase = getAgentSupabase()
  const { data: conversations, error: conversationError } = await supabase
    .from("conversations")
    .select(
      "session_id, landbot_customer_id, conversation_ref, department, inquiry_type, closed_at, assigned_agent_code, assigned_at"
    )
    .or(
      `landbot_customer_id.eq.${id},session_id.eq.${id},conversation_ref.eq.${id}`
    )
    .order("last_message_at", { ascending: false })
    .limit(3)

  if (conversationError) throw conversationError
  const conversation = conversations?.[0]
  if (!conversation) {
    console.error(`No conversation for ${id}`)
    process.exit(1)
  }

  const sessionIds = Array.from(
    new Set(
      [id, conversation.session_id, conversation.landbot_customer_id, conversation.conversation_ref]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  )

  console.log("CRM")
  console.log(JSON.stringify(conversation, null, 2))

  const { data: messages, error: messageError } = await supabase
    .from("messages")
    .select("sent_at, direction, sender_type, body")
    .in("session_id", sessionIds)
    .not("body", "is", null)
    .order("sent_at", { ascending: true })
    .limit(80)

  if (messageError) throw messageError
  console.log("\nTIMELINE")
  for (const row of messages ?? []) {
    const who = row.direction === "incoming" || row.sender_type === "customer" ? "customer" : "bot"
    console.log(`[${row.sent_at}] ${who}: ${clip(row.body)}`)
  }

  const { data: agentTurns, error: agentError } = await supabase
    .from("hom_agent_messages")
    .select("created_at, role, action, agent, content")
    .in("conversation_id", sessionIds)
    .order("created_at", { ascending: true })
    .limit(40)

  if (agentError) throw agentError
  if (agentTurns?.length) {
    console.log("\nAGENT TURNS")
    for (const row of agentTurns) {
      console.log(
        `[${row.created_at}] ${row.role} action=${row.action ?? "-"} agent=${row.agent ?? "-"}: ${clip(row.content, 400)}`
      )
    }
  }

  const { data: shadow, error: shadowError } = await supabase
    .from("hom_agent_shadow_logs")
    .select("created_at, action, llm_calls, routing_path, fallback_layer, user_text, draft_reply")
    .in("conversation_id", sessionIds)
    .order("created_at", { ascending: true })
    .limit(20)

  if (shadowError) throw shadowError
  if (shadow?.length) {
    console.log("\nSHADOW")
    for (const row of shadow) {
      console.log(
        `[${row.created_at}] action=${row.action ?? "-"} llm=${row.llm_calls ?? "-"} path=${row.routing_path ?? "-"} fallback=${row.fallback_layer ?? "-"}`
      )
      console.log(`  user: ${clip(row.user_text, 240)}`)
      console.log(`  draft: ${clip(row.draft_reply, 240)}`)
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
