import { NextResponse } from "next/server"
import { isAuthorized } from "@/lib/agents/auth"
import { isCronAuthorized } from "@/lib/agents/cron-auth"
import { runGokuTrainerSweep } from "@/lib/agents/goku-trainer"

export const maxDuration = 300
export const runtime = "nodejs"

export async function GET(request: Request) {
  if (!isCronAuthorized(request) && !isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json({
    ok: true,
    enabled: process.env.GOKU_TRAINER_ENABLED?.trim() ?? "",
    model: process.env.GOKU_TRAINER_MODEL?.trim() || "anthropic/claude-opus-4.5",
    auto_apply_confidence:
      process.env.GOKU_AUTO_APPLY_CONFIDENCE?.trim() || "0.85",
    run: "POST /api/cron/goku-trainer with Authorization: Bearer $CRON_SECRET or AGENT_API_KEY",
  })
}

export async function POST(request: Request) {
  if (!isCronAuthorized(request) && !isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const limitRaw = Number(url.searchParams.get("limit") ?? "8")
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 20) : 8
    const result = await runGokuTrainerSweep(limit)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "GOKU sweep failed"
    console.error("[goku-trainer] cron failed", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
