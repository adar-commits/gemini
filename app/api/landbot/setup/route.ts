import { NextResponse } from "next/server"
import { isAuthorized } from "@/lib/agents/auth"
import { landbotPhonePolicy } from "@/lib/landbot/allowlist"
import { inspectMessageHooks, syncMessageHook } from "@/lib/landbot/sync-hook"

export const runtime = "nodejs"

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const hooks = await inspectMessageHooks()
    return NextResponse.json({
      ok: true,
      policy: landbotPhonePolicy(),
      ...hooks,
      sync: 'POST {"force":true} to recreate hook with current LANDBOT_WEBHOOK_TOKEN',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Setup failed"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  let force = false
  try {
    const body = await request.json()
    force = Boolean(body?.force)
  } catch {
    force = false
  }

  try {
    const result = await syncMessageHook(force)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Hook registration failed"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
