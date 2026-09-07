import { NextResponse } from "next/server"
import { isAuthorized } from "@/lib/agents/auth"
import { isCronAuthorized } from "@/lib/agents/cron-auth"
import {
  applyWeeklyHighConfidenceSuggestions,
  gokuWeeklyApplyConfidence,
  listWeeklyPolicyBuckets,
} from "@/lib/agents/goku-trainer"

export const runtime = "nodejs"
export const maxDuration = 300

export async function GET(request: Request) {
  if (!isCronAuthorized(request) && !isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const summary = await listWeeklyPolicyBuckets(7)
    return NextResponse.json({
      ok: true,
      mode: "weekly",
      threshold: gokuWeeklyApplyConfidence(),
      summary,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read weekly policy summary"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!isCronAuthorized(request) && !isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await applyWeeklyHighConfidenceSuggestions(7)
    return NextResponse.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to apply weekly policy suggestions"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
