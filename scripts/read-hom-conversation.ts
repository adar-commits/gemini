/**
 * Print one HoM CRM thread for QA. Argument is the id from
 * https://service.hom-group.co.il/conversations/<id>
 *
 * Default for QA automations: --event-window (current incident only, not lifetime thread).
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { getAgentSupabase } from "@/lib/agents/supabase"
import { resolveQaEventWindow } from "@/lib/landbot/qa-event-window"
import { buildQaTranscript } from "@/lib/landbot/qa-transcript"

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

type ReadMode =
  | { kind: "all"; since?: undefined }
  | { kind: "event_window" }
  | { kind: "since"; since: string }

function parseArgs(argv: string[]) {
  const id = (argv[0]?.trim() ?? "").replace(/[^\dA-Za-z_-]/g, "")
  if (!id) {
    console.error(
      "Usage: npx tsx scripts/read-hom-conversation.ts <conversation-id> [--event-window|--since-opened|--since-reset|--since=ISO]"
    )
    process.exit(1)
  }

  let mode: ReadMode = { kind: "event_window" }
  for (const arg of argv.slice(1)) {
    if (arg === "--event-window") {
      mode = { kind: "event_window" }
      continue
    }
    if (arg === "--since-opened" || arg === "--since-reset") {
      mode = { kind: "since", since: arg }
      continue
    }
    if (arg.startsWith("--since=")) {
      mode = { kind: "since", since: arg.slice("--since=".length).trim() }
      continue
    }
    if (arg === "--full-thread") {
      mode = { kind: "all" }
      continue
    }
    console.error(`Unknown flag: ${arg}`)
    process.exit(1)
  }

  return { id, mode }
}

async function resolveSince(id: string, mode: ReadMode) {
  if (mode.kind === "all") return null

  if (mode.kind === "since" && mode.since !== "--since-opened" && mode.since !== "--since-reset") {
    return mode.since
  }

  const supabase = getAgentSupabase()
  const { data: conversation } = await supabase
    .from("conversations")
    .select("session_id, opened_at")
    .or(`landbot_customer_id.eq.${id},session_id.eq.${id},conversation_ref.eq.${id}`)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (mode.kind === "since" && mode.since === "--since-opened") {
    return conversation?.opened_at ?? null
  }

  const window = await resolveQaEventWindow(id)
  if (mode.kind === "since" && mode.since === "--since-reset") {
    if (window?.reason === "trainer_reset" || window?.reason === "agent_reset") {
      return window.since
    }
    return window?.since ?? null
  }

  return window?.since ?? null
}

async function main() {
  const { id, mode } = parseArgs(process.argv.slice(2))
  const supabase = getAgentSupabase()
  const { data: conversations, error: conversationError } = await supabase
    .from("conversations")
    .select(
      "session_id, landbot_customer_id, conversation_ref, department, inquiry_type, closed_at, assigned_agent_code, assigned_at, opened_at, message_count"
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

  const eventWindow =
    mode.kind === "event_window" ? await resolveQaEventWindow(id) : null
  const since =
    mode.kind === "event_window"
      ? eventWindow?.since ?? null
      : await resolveSince(id, mode)

  console.log("CRM")
  console.log(JSON.stringify(conversation, null, 2))

  if (eventWindow) {
    console.log("\nEVENT WINDOW (analyze this scope only)")
    console.log(
      JSON.stringify(
        {
          since: eventWindow.since,
          reason: eventWindow.reason,
          event_window_message_count: eventWindow.eventWindowMessageCount,
          total_message_count: eventWindow.totalMessageCount,
        },
        null,
        2
      )
    )
  } else if (since) {
    console.log("\nFILTER")
    console.log(JSON.stringify({ since }, null, 2))
  } else if (mode.kind !== "all") {
    console.log("\nFILTER")
    console.log(JSON.stringify({ warning: "no window boundary — showing last 80 messages" }, null, 2))
  }

  const transcript = await buildQaTranscript({
    conversationId: id,
    since,
    maxChars: 200_000,
    fullThread: mode.kind === "all",
  })
  console.log(`\n${transcript ?? "TIMELINE\n(no messages)"}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
