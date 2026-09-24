/**
 * Revert one QA automation commit and mark it vanished in the brief log.
 *
 * Usage: npm run qa:vanish -- abc1234def5678
 */
import { execSync } from "node:child_process"
import { appendFileSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = join(process.cwd(), ".cursor/automations/hom-conversation-qa")
const LOG_PATH = join(ROOT, "commit-log.jsonl")
const BRIEF_PATH = join(ROOT, "BRIEF.md")

function main() {
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

main()
