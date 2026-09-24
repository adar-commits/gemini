/**
 * Chain Grok analyze → Composer implement (local / fallback).
 * Prefer production proxy: POST /api/agents/qa-chain-implement (uses Vercel env).
 *
 * Usage:
 *   npx tsx scripts/chain-qa-implement-webhook.ts .cursor/qa-queue/532452401.analysis.json
 *   npx tsx scripts/chain-qa-implement-webhook.ts .cursor/qa-queue/532452401.analysis.json --source-payload .cursor/qa-queue/532452401.source.json
 */
import { readFileSync } from "node:fs"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { parseQaAnalysis } from "../lib/hom-agent/qa-analysis"
import type { CursorAutomationQaPayload } from "../lib/landbot/cursor-automation-qa"
import { chainQaImplement } from "../lib/landbot/qa-chain-implement"

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

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as unknown
}

async function main() {
  loadEnvFile(".env.production.local")
  loadEnvFile(".env.local")

  const analysisPath = process.argv[2]
  if (!analysisPath) {
    console.error(
      "Usage: npx tsx scripts/chain-qa-implement-webhook.ts <analysis.json> [--source-payload source.json]"
    )
    process.exit(1)
  }

  const analysis = parseQaAnalysis(readJson(analysisPath))
  if (!analysis) {
    console.error(
      "Invalid analysis JSON — see .cursor/automations/hom-conversation-qa/analysis-schema.json"
    )
    process.exit(1)
  }

  const sourceFlag = process.argv.indexOf("--source-payload")
  const sourcePath = sourceFlag >= 0 ? process.argv[sourceFlag + 1] : null
  const source = sourcePath
    ? (readJson(sourcePath) as CursorAutomationQaPayload)
    : undefined

  const result = await chainQaImplement({ analysis, source })
  console.log(JSON.stringify(result, null, 2))

  if (!result.ok) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
