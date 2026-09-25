/**
 * Report automation progress to the /dashboard/qa event gauge.
 *
 *   npm run qa:stage -- --stage reading --key "<idempotency_key>" --session <session_id>
 *
 * Stages: reading | analyzing | coding | testing
 * (decision is stamped by qa:log, pushed-to-main by log-qa-automation-commit.ts)
 */
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
  markQaRunStage,
  QA_REPORTED_STAGES,
  type QaReportedStage,
} from "../lib/agents/qa-automation-log"

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

async function main() {
  loadEnvFile(".env.production.local")
  loadEnvFile(".env.local")

  const stage = arg("--stage") as QaReportedStage
  const key = arg("--key")
  const sessionId = arg("--session")

  if (!QA_REPORTED_STAGES.includes(stage) || (!key && !sessionId)) {
    console.error(
      `Usage: qa:stage --stage <${QA_REPORTED_STAGES.join("|")}> --key <idempotency_key> [--session <id>]`
    )
    process.exit(1)
  }

  const row = await markQaRunStage({ stage, idempotencyKey: key, sessionId })
  if (!row) {
    console.warn(`[qa-stage] no dashboard row for key=${key} session=${sessionId} — continuing`)
    return
  }
  console.log(JSON.stringify({ ok: true, id: row.id, stage }))
}

main().catch((error) => {
  // Progress pings must never block the automation run.
  console.warn(`[qa-stage] ${error instanceof Error ? error.message : error}`)
})
