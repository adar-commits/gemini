/**
 * Revert one QA automation commit and mark it vanished in the brief log.
 *
 * Usage: npm run qa:vanish -- abc1234def5678
 */
import { execSync } from "node:child_process"
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { markQaRunVanishedByCommitSha } from "../lib/agents/qa-automation-log"

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

const ROOT = join(process.cwd(), ".cursor/automations/hom-conversation-qa")
const LOG_PATH = join(ROOT, "commit-log.jsonl")
const BRIEF_PATH = join(ROOT, "BRIEF.md")

async function main() {
  loadEnvFile(".env.production.local")
  loadEnvFile(".env.local")

  const sha = process.argv[2]?.trim()
  if (!sha) {
    console.error("Usage: npm run qa:vanish -- <commit-sha>")
    process.exit(1)
  }

  execSync(`git revert ${sha} --no-edit`, {
    stdio: "inherit",
    cwd: process.cwd(),
  })

  const vanishedAt = new Date().toISOString()
  appendFileSync(
    LOG_PATH,
    `${JSON.stringify({ sha, status: "vanished", vanished_at: vanishedAt })}\n`,
    "utf8"
  )

  try {
    await markQaRunVanishedByCommitSha(sha)
  } catch (error) {
    console.warn(
      "[qa:vanish] dashboard log update failed",
      error instanceof Error ? error.message : error
    )
  }

  try {
    let brief = readFileSync(BRIEF_PATH, "utf8")
    brief = brief.replace(
      new RegExp(`^- \\*\\*${sha.slice(0, 7)}\\*\\*`, "m"),
      `- ~~**${sha.slice(0, 7)}** (vanished ${vanishedAt.slice(0, 10)})~~`
    )
    writeFileSync(BRIEF_PATH, brief, "utf8")
  } catch {
    // brief optional
  }

  console.log(`Vanished commit ${sha} — revert commit created. Push when ready.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
