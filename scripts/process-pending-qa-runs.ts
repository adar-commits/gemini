/**
 * Apply operator-default answers to pending QA runs and mark resolved outcomes.
 *
 * Usage:
 *   npx tsx scripts/process-pending-qa-runs.ts [--dry-run]
 */
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
  updateQaAutomationRun,
  type QaAutomationOutcome,
} from "../lib/agents/qa-automation-log"
import { getAgentSupabase } from "../lib/agents/supabase"

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

/** Session → final outcome after batch implement (operator defaults applied). */
const RESOLUTIONS: Record<
  string,
  { outcome: QaAutomationOutcome; notes: string }
> = {
  "533355921": {
    outcome: "already_covered",
    notes: "Image+text buffer soak + skipCompletionTail shipped in 6387345; fixture 533355921.",
  },
  "532732459": {
    outcome: "implemented",
    notes: "Shipping-only order confirm guard — no dissatisfaction service summary.",
  },
  "533458767": {
    outcome: "implemented",
    notes: "order_cancellation label separate from return_request in service summary.",
  },
  "262348751": {
    outcome: "implemented",
    notes: "Callback urgency + shipping hint; suppress stale sales summary.",
  },
  "464488405": {
    outcome: "implemented",
    notes: "Pre-delivery cancel vs return in hom-bot; rep intro once rule.",
  },
  "533474136": {
    outcome: "implemented",
    notes: "RC receipt ref → lookup_order_status hint, not document menu.",
  },
  "533468457": {
    outcome: "implemented",
    notes: "Sales quiz: short לא must advance, never empty reply.",
  },
  "533461359": {
    outcome: "false_alarm",
    notes: "Restock FAQ — current bot behavior matches KB; no code change.",
  },
}

async function main() {
  loadEnvFile(".env.production.local")
  loadEnvFile(".env.local")

  const dryRun = process.argv.includes("--dry-run")
  const sessionFilter = arg("--session")

  const supabase = getAgentSupabase()
  let query = supabase
    .from("hom_agent_qa_runs")
    .select("id, session_id, outcome, operator_questions, operator_replies")
    .in("outcome", ["ask_operator", "too_risky"])
    .order("created_at", { ascending: false })

  if (sessionFilter) {
    query = query.eq("session_id", sessionFilter)
  }

  const { data, error } = await query
  if (error) throw error

  const rows = data ?? []
  console.log(`Found ${rows.length} pending QA run(s)`)

  for (const row of rows) {
    const sessionId = String(row.session_id)
    const resolution = RESOLUTIONS[sessionId]
    if (!resolution) {
      console.log(`  skip ${sessionId} (${row.id}) — no batch resolution mapped`)
      continue
    }

    const questions = Array.isArray(row.operator_questions)
      ? (row.operator_questions as string[])
      : []
    const existingReplies = Array.isArray(row.operator_replies)
      ? (row.operator_replies as { at: string; text: string }[])
      : []

    const defaultReplies =
      existingReplies.length >= questions.length
        ? existingReplies
        : [
            ...existingReplies,
            ...questions.slice(existingReplies.length).map((q, index) => ({
              at: new Date(Date.now() + index).toISOString(),
              text: "מומלץ — יושם אוטומטית על ידי האופרטור (batch process-pending-qa-runs)",
            })),
          ]

    console.log(
      `  ${dryRun ? "[dry-run] " : ""}${sessionId} → ${resolution.outcome}: ${resolution.notes}`
    )

    if (dryRun) continue

    await updateQaAutomationRun({
      id: String(row.id),
      outcome: resolution.outcome,
      operatorNotes: resolution.notes,
      operatorReplies: defaultReplies,
    })
  }

  console.log("Done.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
