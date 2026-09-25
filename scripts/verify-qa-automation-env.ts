/**
 * Verify QA self-improve automation env (production gemini).
 *
 *   npx tsx scripts/verify-qa-automation-env.ts
 */
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
  cursorAutomationQaAuthToken,
  cursorAutomationQaEnabled,
  cursorAutomationQaTriggers,
  cursorAutomationQaWebhookUrl,
} from "../lib/landbot/cursor-automation-qa"

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

const required = [
  ["CURSOR_AUTOMATION_QA_WEBHOOK_URL", Boolean(cursorAutomationQaWebhookUrl())],
  ["CURSOR_AUTOMATION_QA_WEBHOOK_TOKEN", Boolean(cursorAutomationQaAuthToken())],
  ["CURSOR_AUTOMATION_QA_ENABLED (effective)", cursorAutomationQaEnabled()],
  ["CRON_SECRET", Boolean(process.env.CRON_SECRET?.trim())],
] as const

console.log("QA automation env (Vercel / local production files)\n")
for (const [name, ok] of required) {
  console.log(`${ok ? "OK" : "MISSING"}  ${name}`)
}
console.log(`\nTriggers: ${[...cursorAutomationQaTriggers()].join(", ")}`)
console.log(
  "\nAutomation secrets (Cursor → automation → Secrets):\n  CRON_SECRET, AGENT_SUPABASE_URL, AGENT_SUPABASE_SERVICE_ROLE_KEY = same as Vercel production"
)

const missing = required.filter(([, ok]) => !ok)
process.exit(missing.length ? 1 : 0)
