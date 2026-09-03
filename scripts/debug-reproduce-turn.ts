/**
 * Local reproduction for invoke failures — loads .env.production.local
 * Usage: npx tsx scripts/debug-reproduce-turn.ts [reset|question]
 */
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

function loadEnvFile(path: string) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, "utf8").split("\n")) {
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
}

loadEnvFile(join(process.cwd(), ".env.local"))
loadEnvFile(join(process.cwd(), ".env.production.local"))

const mode = process.argv[2] ?? "question"
const QUESTION =
  "היי שלום אני רוצה לדעת אם אני קיבלתי את השטיח היום ואני רוצה להחזיר אותו מחר לסניף בראשון זה אפשר?"

async function main() {
  const { debugSessionLog } = await import("@/lib/debug/session-log")
  const { bindRuntimeConfig } = await import("@/lib/agent-core/config")
  const { invokeHomAgent } = await import("@/lib/hom-agent/invoke")
  const { runHomAgentTurn } = await import("@/lib/hom-agent/run-turn")
  const { splitTrainerResetBody, buildTrainerResetReply } = await import(
    "@/lib/landbot/trainer-reset"
  )

  const runtime = await bindRuntimeConfig()
  debugSessionLog({
    location: "debug-reproduce-turn.ts:main",
    message: "runtime config",
    hypothesisId: "H3",
    data: {
      faqModel: runtime.profile.faq.model,
      source: runtime.source,
    },
  })

  if (mode === "reset") {
    const split = splitTrainerResetBody("איפוס")
    debugSessionLog({
      location: "debug-reproduce-turn.ts:reset",
      message: "trainer reset split",
      hypothesisId: "H1",
      data: { ...split, replyPreview: buildTrainerResetReply().slice(0, 80) },
    })
    console.log("reset split", split)
    return
  }

  const conversationId = `debug-repro-${Date.now()}`
  const turn = { text: QUESTION, media: [] as import("@/lib/agents/user-turn").UserMediaPart[] }

  try {
    const direct = await invokeHomAgent({
      conversationId,
      turn,
      history: [
        { role: "user", content: "איפוס" },
        { role: "assistant", content: buildTrainerResetReply() },
      ],
      body: QUESTION,
      phone: "+972547495083",
    })
    debugSessionLog({
      location: "debug-reproduce-turn.ts:invoke",
      message: "invokeHomAgent ok",
      hypothesisId: "H4",
      data: { model: direct.model, llmCalls: direct.llmCalls, action: direct.output.action },
    })
    console.log("invoke ok", direct)
  } catch (error) {
    debugSessionLog({
      location: "debug-reproduce-turn.ts:invoke",
      message: "invokeHomAgent failed",
      hypothesisId: "H4",
      data: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack?.slice(0, 500) : undefined,
      },
    })
    console.error("invoke failed", error)
  }

  try {
    const turnResult = await runHomAgentTurn(conversationId + "-turn", turn, {
      phone: "+972547495083",
      persistTurn: false,
      priorityApiEnabled: false,
    })
    debugSessionLog({
      location: "debug-reproduce-turn.ts:run-turn",
      message: "runHomAgentTurn ok",
      hypothesisId: "H5",
      data: {
        replyPreview: turnResult.reply?.slice(0, 120),
        metrics: turnResult.metrics,
      },
    })
    console.log("run-turn ok", turnResult.reply?.slice(0, 200))
  } catch (error) {
    debugSessionLog({
      location: "debug-reproduce-turn.ts:run-turn",
      message: "runHomAgentTurn failed",
      hypothesisId: "H5",
      data: { error: error instanceof Error ? error.message : String(error) },
    })
    console.error("run-turn failed", error)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
