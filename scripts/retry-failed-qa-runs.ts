/**
 * Re-send QA automation webhooks for failed rows, one at a time.
 *
 * Usage:
 *   npx tsx scripts/retry-failed-qa-runs.ts --since 2026-09-30T08:26:00Z [--dry-run] [--wait-min 18]
 */
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
  getQaAutomationRunById,
  type QaAutomationRunRow,
} from "../lib/agents/qa-automation-log"
import { getAgentSupabase } from "../lib/agents/supabase"
import {
  canRetryQaRun,
  retryQaAutomationRun,
} from "../lib/landbot/qa-run-retry"

function loadEnvFile(relativePath: string) {
  const path = join(process.cwd(), relativePath)
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
    if (!value) continue
    if (!process.env[key]?.trim()) process.env[key] = value
  }
}

function purgeEmptyEnv(keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim().replace(/^["']|["']$/g, "")
    if (!value) delete process.env[key]
    else process.env[key] = value
  }
}

function arg(name: string) {
  const idx = process.argv.indexOf(name)
  return idx >= 0 ? process.argv[idx + 1]?.trim() : ""
}

function hasFlag(name: string) {
  return process.argv.includes(name)
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

const IN_FLIGHT = new Set(["triggered", "chained"])

function isSettled(run: QaAutomationRunRow) {
  return !IN_FLIGHT.has(run.outcome)
}

async function listFailedSince(sinceIso: string) {
  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_qa_runs")
    .select("id, session_id, trigger, outcome, created_at, updated_at")
    .eq("outcome", "webhook_failed")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: true })

  if (error) throw error
  return data ?? []
}

async function waitForSettled(runId: string, waitMs: number) {
  const started = Date.now()
  while (Date.now() - started < waitMs) {
    await sleep(15_000)
    const run = await getQaAutomationRunById(runId)
    if (!run) return { status: "missing" as const }
    if (isSettled(run)) {
      return { status: "settled" as const, outcome: run.outcome }
    }
  }
  const run = await getQaAutomationRunById(runId)
  return {
    status: "timeout" as const,
    outcome: run?.outcome ?? "unknown",
  }
}

async function main() {
  purgeEmptyEnv([
    "AGENT_SUPABASE_URL",
    "AGENT_SUPABASE_SERVICE_ROLE_KEY",
    "CURSOR_AUTOMATION_QA_WEBHOOK_URL",
    "CURSOR_AUTOMATION_QA_WEBHOOK_TOKEN",
  ])
  loadEnvFile(".env.vercel.production")
  loadEnvFile(".env.production.local")
  loadEnvFile(".env.local")
  purgeEmptyEnv([
    "AGENT_SUPABASE_URL",
    "AGENT_SUPABASE_SERVICE_ROLE_KEY",
    "CURSOR_AUTOMATION_QA_WEBHOOK_URL",
    "CURSOR_AUTOMATION_QA_WEBHOOK_TOKEN",
  ])

  const since =
    arg("--since") ||
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const dryRun = hasFlag("--dry-run")
  const waitMin = Number(arg("--wait-min") || "18")
  const waitMs = Math.min(Math.max(waitMin, 5), 45) * 60_000

  const rows = await listFailedSince(since)
  console.log(`Found ${rows.length} webhook_failed run(s) since ${since}`)

  if (!rows.length) return

  for (const row of rows) {
    const id = String(row.id)
    const label = `${id.slice(0, 8)} session=${row.session_id} trigger=${row.trigger} at=${row.created_at}`
    const full = await getQaAutomationRunById(id)
    if (!full) {
      console.log(`SKIP ${label} — not found`)
      continue
    }
    if (!canRetryQaRun(full)) {
      console.log(`SKIP ${label} — not retryable (outcome=${full.outcome})`)
      continue
    }
    if (dryRun) {
      console.log(`DRY-RUN would retry ${label}`)
      continue
    }

    console.log(`RETRY ${label}`)
    const result = await retryQaAutomationRun(id)
    if (!result.ok) {
      console.log(`  FAIL send: ${result.error}`)
      continue
    }

    console.log(`  sent — waiting up to ${waitMin}m for automation…`)
    const wait = await waitForSettled(id, waitMs)
    console.log(`  done: ${wait.status}${"outcome" in wait ? ` → ${wait.outcome}` : ""}`)
    await sleep(5_000)
  }

  console.log("Batch complete.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
