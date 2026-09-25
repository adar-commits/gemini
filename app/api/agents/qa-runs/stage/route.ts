import { NextResponse } from "next/server"
import { isCronAuthorized } from "@/lib/agents/cron-auth"
import { isQaCallbackAuthorized } from "@/lib/agents/qa-callback-token"
import {
  markQaRunStage,
  QA_REPORTED_STAGES,
  type QaReportedStage,
} from "@/lib/agents/qa-automation-log"

/** Automation progress ping for the /dashboard/qa event gauge (curl, no npm install needed). */
export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const stage = body.stage as QaReportedStage
  const idempotencyKey = typeof body.idempotency_key === "string" ? body.idempotency_key : null
  if (!isQaCallbackAuthorized(request, idempotencyKey)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  // Session-wide fallback only for CRON_SECRET callers; callback tokens stay on their own event.
  const sessionId =
    isCronAuthorized(request) && typeof body.session_id === "string" ? body.session_id : null

  if (!QA_REPORTED_STAGES.includes(stage) || (!idempotencyKey && !sessionId)) {
    return NextResponse.json(
      { error: `Need stage (${QA_REPORTED_STAGES.join("|")}) and idempotency_key or session_id` },
      { status: 400 }
    )
  }

  try {
    const row = await markQaRunStage({ stage, idempotencyKey, sessionId })
    if (!row) return NextResponse.json({ ok: false, error: "run_not_found" }, { status: 404 })
    return NextResponse.json({ ok: true, id: row.id, stage })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Stage update failed" },
      { status: 500 }
    )
  }
}
