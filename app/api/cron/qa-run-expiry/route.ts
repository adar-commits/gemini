import { NextResponse } from "next/server"
import { isAuthorized } from "@/lib/agents/auth"
import { isCronAuthorized } from "@/lib/agents/cron-auth"
import {
  expireStaleQaRuns,
  QA_RUN_ANALYZE_TIMEOUT_MS,
  QA_RUN_IMPLEMENT_TIMEOUT_MS,
} from "@/lib/agents/qa-run-expiry"

export const runtime = "nodejs"

export async function GET(request: Request) {
  if (!isCronAuthorized(request) && !isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json({
    ok: true,
    analyze_timeout_minutes: Math.round(QA_RUN_ANALYZE_TIMEOUT_MS / 60_000),
    implement_timeout_minutes: Math.round(QA_RUN_IMPLEMENT_TIMEOUT_MS / 60_000),
    run: "POST /api/cron/qa-run-expiry with Authorization: Bearer $CRON_SECRET or AGENT_API_KEY",
  })
}

export async function POST(request: Request) {
  if (!isCronAuthorized(request) && !isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await expireStaleQaRuns()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "QA expiry failed"
    console.error("[qa-run-expiry] cron failed", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
