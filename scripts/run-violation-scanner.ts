/**
 * Manual sentinel scan — prod sample + GOKU ≤6 conversations.
 *
 * Usage:
 *   npx --yes dotenv-cli -e .env.production.local -- npx tsx scripts/run-violation-scanner.ts
 */
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

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

async function main() {
  const { runViolationScanner } = await import("../lib/hom-agent/violation-scanner")
  const result = await runViolationScanner({
    limit: 400,
    hours: 48,
    includeGoku: true,
    writeDrafts: true,
  })

  console.log(
    JSON.stringify(
      {
        ok: true,
        scanned: result.scanned,
        violationCount: result.violations.length,
        violations: result.violations,
        draftCount: result.draftContracts.length,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
