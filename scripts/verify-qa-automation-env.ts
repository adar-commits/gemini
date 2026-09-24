/**
 * Verify Vercel-side QA automation env (production gemini).
 *
 *   npx tsx scripts/verify-qa-automation-env.ts
 */
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { qaChainImplementEnvStatus } from "../lib/landbot/qa-chain-implement"
import {
  cursorAutomationQaAnalyzeWebhookUrl,
  cursorAutomationQaEnabled,
  cursorAutomationQaTriggers,
} from "../lib/landbot/cursor-automation-qa"
import { internalApiOrigin } from "../lib/landbot/sync-hook"

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
loadEnvFile(".env.local")

const env = qaChainImplementEnvStatus()
const required = [
  ["CURSOR_AUTOMATION_QA_ENABLED", cursorAutomationQaEnabled()],
  ["CURSOR_AUTOMATION_QA_ANALYZE_URL", Boolean(cursorAutomationQaAnalyzeWebhookUrl())],
  ["CURSOR_AUTOMATION_QA_ANALYZE_TOKEN", env.analyze_token],
  ["CURSOR_AUTOMATION_QA_IMPLEMENT_URL", env.implement_url],
  ["CURSOR_AUTOMATION_QA_IMPLEMENT_TOKEN", env.implement_token],
  ["CRON_SECRET", env.cron_secret],
] as const

console.log("QA automation env (Vercel / local production files)\n")
for (const [name, ok] of required) {
  console.log(`${ok ? "OK" : "MISSING"}  ${name}`)
}
console.log(`\nTriggers: ${[...cursorAutomationQaTriggers()].join(", ")}`)
console.log(`Chain proxy: ${internalApiOrigin()}/api/agents/qa-chain-implement`)
console.log(
  "\nAnalyze automation (Cursor secrets) needs only:\n  CRON_SECRET = same as Vercel production"
)
console.log(
  "Optional local chain:\n  npx tsx scripts/chain-qa-implement-webhook.ts .cursor/qa-queue/<id>.analysis.json"
)

const missing = required.filter(([, ok]) => !ok)
process.exit(missing.length ? 1 : 0)
