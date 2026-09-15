/**
 * Import a production thread into a draft conversation contract.
 *
 * Usage:
 *   npx --yes dotenv-cli -e .env.production.local -- npx tsx scripts/contracts-import.ts --session 507969015
 *   npx --yes dotenv-cli -e .env.production.local -- npx tsx scripts/contracts-import.ts --phone 0524247266
 */
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { existsSync, readFileSync } from "node:fs"
import { loadFullConversationTranscript } from "@/lib/agents/goku-trainer"
import { getAgentSupabase } from "@/lib/agents/supabase"
import type { ConversationContract } from "@/lib/hom-agent/contracts/types"
import type { HistoryMessage } from "@/lib/agents/types"

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

loadEnvFile(".env.production.local")

function parseArgs() {
  const args = process.argv.slice(2)
  let session: string | undefined
  let phone: string | undefined
  let turnIndex: number | undefined

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--session") session = args[index + 1]
    if (args[index] === "--phone") phone = args[index + 1]
    if (args[index] === "--turn") turnIndex = Number(args[index + 1])
  }

  return { session, phone, turnIndex }
}

async function resolveConversationId(input: {
  session?: string
  phone?: string
}) {
  if (input.session?.trim()) return input.session.trim()

  if (!input.phone?.trim()) {
    throw new Error("Provide --session CONVERSATION_ID or --phone WHATSAPP")
  }

  const supabase = getAgentSupabase()
  const normalized = input.phone.replace(/\D/g, "")
  const { data, error } = await supabase
    .from("hom_agent_sessions")
    .select("conversation_id, customer_phone, updated_at")
    .or(`customer_phone.ilike.%${normalized}%,customer_phone.ilike.%${input.phone}%`)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data?.conversation_id) {
    throw new Error(`No session found for phone ${input.phone}`)
  }
  return data.conversation_id
}

function transcriptToHistory(
  transcript: Awaited<ReturnType<typeof loadFullConversationTranscript>>
): HistoryMessage[] {
  return transcript.map((row) => ({
    role: row.role,
    content: row.content,
    ...(row.agent ? { agent: row.agent as HistoryMessage["agent"] } : {}),
  }))
}

function buildDraftContract(input: {
  conversationId: string
  phone?: string
  history: HistoryMessage[]
  turnText: string
  turnAction?: string | null
}): ConversationContract {
  const slug = input.conversationId.replace(/[^a-zA-Z0-9_-]/g, "-")
  return {
    id: `import-${slug}`,
    description: `Imported from production session ${input.conversationId}`,
    source: {
      session: input.conversationId,
      phone: input.phone,
    },
    history: input.history,
    turn: {
      text: input.turnText,
      phone: input.phone,
    },
    assertions: [
      {
        type: "coerce",
        inputAction: "human_service",
        expectAction: "reply",
      },
    ],
    snapshot: input.turnAction
      ? {
          action: input.turnAction === "human_service" ? "human_service" : "reply",
        }
      : undefined,
  }
}

async function main() {
  const { session, phone, turnIndex } = parseArgs()
  const conversationId = await resolveConversationId({ session, phone })
  const transcript = await loadFullConversationTranscript(conversationId)
  const historyMessages = transcriptToHistory(transcript)

  if (historyMessages.length === 0) {
    throw new Error(`No messages in conversation ${conversationId}`)
  }

  let history: HistoryMessage[] = historyMessages
  let turnText = historyMessages[historyMessages.length - 1]?.content ?? ""
  let turnAction: string | null = null

  if (typeof turnIndex === "number" && Number.isFinite(turnIndex)) {
    const userIndex = turnIndex * 2
    const assistantIndex = userIndex + 1
    history = historyMessages.slice(0, userIndex)
    turnText = historyMessages[userIndex]?.content ?? turnText
    turnAction = transcript[assistantIndex]?.action ?? null
  } else {
    const lastUserIndex = [...historyMessages]
      .map((message, index) => ({ message, index }))
      .reverse()
      .find((entry) => entry.message.role === "user")?.index
    if (lastUserIndex != null) {
      history = historyMessages.slice(0, lastUserIndex)
      turnText = historyMessages[lastUserIndex].content
      const assistant = historyMessages[lastUserIndex + 1]
      turnAction = assistant?.role === "assistant"
        ? transcript[lastUserIndex + 1]?.action ?? null
        : null
    }
  }

  const supabase = getAgentSupabase()
  const { data: sessionRow } = await supabase
    .from("hom_agent_sessions")
    .select("customer_phone")
    .eq("conversation_id", conversationId)
    .maybeSingle()

  const resolvedPhone = phone ?? sessionRow?.customer_phone ?? undefined
  const draft = buildDraftContract({
    conversationId,
    phone: resolvedPhone,
    history,
    turnText,
    turnAction,
  })

  const draftsDir = join(process.cwd(), "lib/hom-agent/contracts/drafts")
  await mkdir(draftsDir, { recursive: true })
  const outPath = join(draftsDir, `${draft.id}.json`)
  await writeFile(outPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8")

  console.log(JSON.stringify({ ok: true, conversationId, outPath, draft }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
