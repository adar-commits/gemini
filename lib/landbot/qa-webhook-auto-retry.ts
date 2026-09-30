import { after } from "next/server"
import {
  getQaAutomationRunById,
  updateQaAutomationRun,
} from "@/lib/agents/qa-automation-log"
import { getAgentSupabase } from "@/lib/agents/supabase"
import { canRetryQaRun, retryQaAutomationRun } from "@/lib/landbot/qa-run-retry"

export const WEBHOOK_AUTO_RETRY_DELAY_MS = 10_000
export const WEBHOOK_AUTO_RETRY_MAX = 3

const AUTO_RETRY_NOTE_RE = /\[auto-retry\s+(\d+)\]/gi

export function webhookAutoRetryCount(operatorNotes: string | null | undefined) {
  if (!operatorNotes?.trim()) return 0
  const matches = [...operatorNotes.matchAll(AUTO_RETRY_NOTE_RE)]
  if (!matches.length) return 0
  return Math.max(...matches.map((match) => Number(match[1]) || 0))
}

/** Plain-Hebrew explanation of why the webhook failed — for the dashboard. */
export function diagnoseWebhookFailure(
  operatorNotes: string | null | undefined,
  rootCause: string | null | undefined
) {
  const text = `${operatorNotes ?? ""} ${rootCause ?? ""}`.trim()
  if (!text) {
    return "סיבה לא ידועה — ינסה שוב אוטומטית בעוד ~10 שניות, או לחץ ↻"
  }
  if (/401|authorization|unauthorized/i.test(text)) {
    return "אימות webhook נכשל (401) — בדוק CURSOR_AUTOMATION_QA_WEBHOOK_TOKEN ב-Vercel. auto-retry בעוד ~10s, או ↻"
  }
  if (/403|forbidden/i.test(text)) {
    return "אין הרשאה ל-webhook (403) — token/automation auth לא תקין"
  }
  if (/404|not found/i.test(text)) {
    return "URL webhook לא נמצא (404) — בדוק CURSOR_AUTOMATION_QA_WEBHOOK_URL"
  }
  if (/429|rate limit/i.test(text)) {
    return "יותר מדי בקשות ל-Cursor (429) — auto-retry ינסה שוב בעוד ~10 שניות"
  }
  if (/missing_webhook_url|missing CURSOR_AUTOMATION_QA_WEBHOOK_URL/i.test(text)) {
    return "חסר CURSOR_AUTOMATION_QA_WEBHOOK_URL ב-Vercel"
  }
  if (/missing.*CURSOR_AUTOMATION_QA_WEBHOOK_TOKEN/i.test(text)) {
    return "חסר CURSOR_AUTOMATION_QA_WEBHOOK_TOKEN ב-Vercel"
  }
  if (/לא השיבה|לא סיימה|timeout|expired stale/i.test(text)) {
    return "האוטומציה לא השיבה בזמן — בדוק cursor.com/automations (תקוע / לא רץ)"
  }
  const http = text.match(/HTTP\s+(\d{3})/i)
  if (http?.[1]) {
    return `Cursor webhook החזיר HTTP ${http[1]} — פרטים בהערות האירוע`
  }
  if (/Retry failed/i.test(text)) {
    return "ניסיון שליחה חוזר נכשל — ראה HTTP code בהערות"
  }
  if (/Webhook POST to Cursor automation failed/i.test(text)) {
    return "שליחה ראשונית ל-Cursor automation נכשלה — בדוק URL + token"
  }
  return text.length > 220 ? `${text.slice(0, 217)}…` : text
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function autoRetrySingleRun(runId: string) {
  const run = await getQaAutomationRunById(runId)
  if (!run || run.outcome !== "webhook_failed") {
    return { ok: false as const, skipped: true as const, reason: "not_failed" as const }
  }
  if (!canRetryQaRun(run)) {
    return { ok: false as const, skipped: true as const, reason: "not_retryable" as const }
  }

  const attempt = webhookAutoRetryCount(run.operator_notes) + 1
  if (attempt > WEBHOOK_AUTO_RETRY_MAX) {
    return { ok: false as const, skipped: true as const, reason: "max_retries" as const }
  }

  const result = await retryQaAutomationRun(runId)
  const diagnosis = diagnoseWebhookFailure(run.operator_notes, run.root_cause)
  const prefix = `[auto-retry ${attempt}]`

  if (result.ok) {
    await updateQaAutomationRun({
      id: runId,
      operatorNotes: `${prefix} נשלח שוב אוטומטית אחרי ${WEBHOOK_AUTO_RETRY_DELAY_MS / 1000}s. ${diagnosis}`,
    })
    return { ok: true as const, attempt }
  }

  await updateQaAutomationRun({
    id: runId,
    outcome: "webhook_failed",
    operatorNotes: `${prefix} ${result.error ?? "retry_failed"} — ${diagnosis}`.slice(0, 2000),
  })
  return { ok: false as const, attempt, error: result.error }
}

/** Schedule one auto-retry ~10s after a webhook_failed row is written. */
export function scheduleWebhookAutoRetry(runId: string) {
  const id = runId.trim()
  if (!id) return

  after(async () => {
    try {
      await sleep(WEBHOOK_AUTO_RETRY_DELAY_MS)
      const first = await autoRetrySingleRun(id)
      if (first.ok || first.skipped) return

      await sleep(WEBHOOK_AUTO_RETRY_DELAY_MS)
      await autoRetrySingleRun(id)
    } catch (error) {
      console.warn("[qa-webhook-auto-retry] scheduled retry failed", {
        runId: id,
        error: error instanceof Error ? error.message : error,
      })
    }
  })
}

/** Cron / dashboard safety net — retry webhook_failed rows past the delay window. */
export async function autoRetryDueWebhookFailures(limit = 10) {
  const supabase = getAgentSupabase()
  const cutoff = new Date(Date.now() - WEBHOOK_AUTO_RETRY_DELAY_MS).toISOString()
  const { data, error } = await supabase
    .from("hom_agent_qa_runs")
    .select("id")
    .eq("outcome", "webhook_failed")
    .lte("updated_at", cutoff)
    .order("updated_at", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 25))

  if (error) throw error

  let retried = 0
  let skipped = 0
  for (const row of data ?? []) {
    const result = await autoRetrySingleRun(String(row.id))
    if (result.ok) retried += 1
    else skipped += 1
  }

  return { retried, skipped, scanned: data?.length ?? 0 }
}
