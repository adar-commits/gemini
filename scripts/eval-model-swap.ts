/**
 * Offline A/B of the HoM agent model on real turns.
 *
 *   npx tsx scripts/eval-model-swap.ts run   <cases.json> <out.json> [model ...]
 *   npx tsx scripts/eval-model-swap.ts judge <out.json> <judged.json> <modelA> <modelB>
 *
 * cases.json: [{ id, conversationId, body, history, phone, customerName, prodReply, prodAction }]
 * Runs the production invokeHomAgent path with modelOverride. Priority calls are limited to
 * read-only actions; Landbot sends and other writes are blocked.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { generateText, jsonSchema, Output } from "ai"
import { invokeHomAgent } from "@/lib/hom-agent/invoke"
import type { HistoryMessage } from "@/lib/agents/types"

const READ_ONLY_PRIORITY_ACTIONS = new Set([
  "getOrders",
  "getInventoryBranch",
  "getDocument",
  "getCampaigns",
])

function loadEnvFile(name: string) {
  try {
    const text = readFileSync(resolve(process.cwd(), name), "utf8")
    for (const line of text.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "").replace(/\\n$/, "")
      if (value && !process.env[key]) process.env[key] = value
    }
  } catch {
    // optional file
  }
}

loadEnvFile(".env.production.local")
loadEnvFile(".env.local")
if (!process.env.AGENT_SUPABASE_SERVICE_ROLE_KEY) {
  // Public key: RLS-protected reads come back empty and writes fail — eval never touches prod data.
  process.env.AGENT_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  process.env.AGENT_SUPABASE_SERVICE_ROLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

const realFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
  if (/landbot\.io/i.test(url)) {
    return new Response(JSON.stringify({ blocked: "eval" }), { status: 403 })
  }
  if (typeof init?.body === "string" && /"actionType"/.test(init.body)) {
    const action = (JSON.parse(init.body) as { actionType?: string }).actionType ?? ""
    if (!READ_ONLY_PRIORITY_ACTIONS.has(action)) {
      return new Response(JSON.stringify({ error: `blocked in eval: ${action}` }), { status: 403 })
    }
  }
  return realFetch(input, init)
}) as typeof fetch

type EvalCase = {
  id: string
  conversationId: string
  body: string
  history: Array<{ role: "user" | "assistant"; content: string; awaiting?: string | null }>
  phone?: string | null
  customerName?: string | null
  prodReply: string
  prodAction: string
}

type ModelRun = { reply: string; action: string; awaiting?: string; ms: number; error?: string }
type CaseResult = EvalCase & { runs: Record<string, ModelRun> }

async function pool<T, R>(items: T[], size: number, fn: (item: T, index: number) => Promise<R>) {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const index = next++
        out[index] = await fn(items[index], index)
      }
    })
  )
  return out
}

async function runCase(c: EvalCase, model: string): Promise<ModelRun> {
  const started = Date.now()
  const history = c.history.map((m) =>
    m.awaiting ? { role: m.role, content: m.content, awaiting: m.awaiting } : { role: m.role, content: m.content }
  ) as HistoryMessage[]
  try {
    const { output } = await invokeHomAgent({
      conversationId: `eval-${c.id}`,
      turn: { text: c.body, media: [] },
      history,
      body: c.body,
      phone: c.phone ?? undefined,
      customerName: c.customerName ?? null,
      modelOverride: model,
    })
    return {
      reply: output.reply,
      action: output.action,
      awaiting: output.awaiting,
      ms: Date.now() - started,
    }
  } catch (error) {
    return {
      reply: "",
      action: "error",
      ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function run(casesPath: string, outPath: string, models: string[]) {
  const cases = JSON.parse(readFileSync(casesPath, "utf8")) as EvalCase[]
  const results: CaseResult[] = cases.map((c) => ({ ...c, runs: {} }))
  for (const model of models) {
    await pool(results, 6, async (c, index) => {
      c.runs[model] = await runCase(c, model)
      if ((index + 1) % 10 === 0) console.log(`${model}: ${index + 1}/${results.length}`)
    })
    writeFileSync(outPath, JSON.stringify(results, null, 1))
  }
  for (const model of models) {
    const runs = results.map((r) => r.runs[model])
    const errors = runs.filter((r) => r.error).length
    const p50 = runs.map((r) => r.ms).sort((a, b) => a - b)[Math.floor(runs.length / 2)]
    console.log(`${model}: errors=${errors} p50=${p50}ms`)
  }
}

type Verdict = {
  a_acceptable: boolean
  b_acceptable: boolean
  better: "A" | "B" | "tie"
  a_issue: string
  b_issue: string
}

const JUDGE_RULES = `You grade two candidate replies from a Hebrew WhatsApp customer-service bot for HoM GROUP (rugs/carpets retailer, Israel).
Both candidates saw the same conversation and the same latest customer message.
A reply is ACCEPTABLE if a careful senior rep would send it: it answers the latest customer message, picks a sensible action
(reply / human_service = transfer to service rep / human_sales = transfer to sales advisor / end = close politely),
does not invent order status, prices, stock or policy, does not say "transferring" without a transfer action, and reads as natural, polite Hebrew.
Minor wording/style differences are NOT issues. Judge substance: correctness, routing, grounding, helpfulness.
The production reply is shown only as a reference of what was actually sent — it is not automatically correct.
Return JSON only.`

async function judgeCase(r: CaseResult, modelA: string, modelB: string): Promise<Verdict & { swapped: boolean }> {
  const swapped = r.id.charCodeAt(r.id.length - 1) % 2 === 1
  const [first, second] = swapped ? [modelB, modelA] : [modelA, modelB]
  const fmt = (run: ModelRun) => `action=${run.action}${run.awaiting ? ` awaiting=${run.awaiting}` : ""}\n${run.reply || "(empty)"}`
  const transcript = r.history
    .slice(-12)
    .map((m) => `${m.role === "user" ? "Customer" : "Bot"}: ${m.content}`)
    .join("\n")
  const result = await generateText({
    model: process.env.EVAL_JUDGE_MODEL?.trim() || "openai/gpt-5.5",
    system: JUDGE_RULES,
    prompt: `CONVERSATION (oldest → newest):\n${transcript || "(no earlier messages)"}\n\nLATEST CUSTOMER MESSAGE:\n${r.body}\n\nREFERENCE (production reply, action=${r.prodAction}):\n${r.prodReply}\n\nCANDIDATE A:\n${fmt(r.runs[first])}\n\nCANDIDATE B:\n${fmt(r.runs[second])}`,
    output: Output.object({
      schema: jsonSchema<Verdict>({
        type: "object",
        additionalProperties: false,
        required: ["a_acceptable", "b_acceptable", "better", "a_issue", "b_issue"],
        properties: {
          a_acceptable: { type: "boolean" },
          b_acceptable: { type: "boolean" },
          better: { type: "string", enum: ["A", "B", "tie"] },
          a_issue: { type: "string", description: "Short reason if A is not acceptable or worse, else empty" },
          b_issue: { type: "string", description: "Short reason if B is not acceptable or worse, else empty" },
        },
      }),
    }),
    temperature: 0,
  })
  const v = result.output as Verdict
  if (!swapped) return { ...v, swapped }
  return {
    a_acceptable: v.b_acceptable,
    b_acceptable: v.a_acceptable,
    better: v.better === "A" ? "B" : v.better === "B" ? "A" : "tie",
    a_issue: v.b_issue,
    b_issue: v.a_issue,
    swapped,
  }
}

async function judge(outPath: string, judgedPath: string, modelA: string, modelB: string) {
  const results = (JSON.parse(readFileSync(outPath, "utf8")) as CaseResult[]).filter(
    (r) => r.runs[modelA] && r.runs[modelB]
  )
  const verdicts = await pool(results, 6, async (r) => {
    try {
      return { id: r.id, ...(await judgeCase(r, modelA, modelB)) }
    } catch (error) {
      return { id: r.id, error: error instanceof Error ? error.message : String(error) }
    }
  })
  writeFileSync(judgedPath, JSON.stringify(verdicts, null, 1))

  const ok = verdicts.filter((v): v is Verdict & { id: string; swapped: boolean } => !("error" in v))
  const actionAgree = results.filter((r) => r.runs[modelA].action === r.runs[modelB].action).length
  console.log(`judged=${ok.length}/${results.length}`)
  console.log(`${modelA} acceptable: ${ok.filter((v) => v.a_acceptable).length}`)
  console.log(`${modelB} acceptable: ${ok.filter((v) => v.b_acceptable).length}`)
  console.log(
    `better: A=${ok.filter((v) => v.better === "A").length} B=${ok.filter((v) => v.better === "B").length} tie=${ok.filter((v) => v.better === "tie").length}`
  )
  console.log(`same action: ${actionAgree}/${results.length}`)
}

async function main() {
  const [mode, ...args] = process.argv.slice(2)
  if (mode === "run") {
    const [casesPath, outPath, ...models] = args
    await run(casesPath, outPath, models.length ? models : ["anthropic/claude-opus-5.5", "anthropic/claude-haiku-5.5"])
  } else if (mode === "judge") {
    const [outPath, judgedPath, modelA, modelB] = args
    await judge(outPath, judgedPath, modelA, modelB)
  } else {
    console.error("usage: eval-model-swap.ts run <cases> <out> [models…] | judge <out> <judged> <modelA> <modelB>")
    process.exit(1)
  }
}

void main()
