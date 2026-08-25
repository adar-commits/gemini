import { NextResponse, after } from "next/server"
import { isAuthorized } from "@/lib/agents/auth"
import { isCronAuthorized } from "@/lib/agents/cron-auth"
import {
  runInactivityWatch,
  type InactivityWatchPayload,
} from "@/lib/landbot/inactivity-watcher"

export const maxDuration = 120
export const runtime = "nodejs"

function parsePayload(body: unknown): InactivityWatchPayload | null {
  if (typeof body !== "object" || body == null) return null
  const value = body as Record<string, unknown>
  const phase = value.phase
  const conversationId = String(value.conversationId ?? "").trim()
  const customerId = Number(value.customerId)

  if (phase !== "ping" && phase !== "close") return null
  if (!conversationId || !Number.isFinite(customerId) || customerId <= 0) return null

  return {
    phase,
    conversationId,
    customerId,
    customerName: String(value.customerName ?? "").trim() || undefined,
    customerPhone: String(value.customerPhone ?? "").trim() || undefined,
    watchAssistantAt: String(value.watchAssistantAt ?? "").trim() || undefined,
    watchPingSentAt: String(value.watchPingSentAt ?? "").trim() || undefined,
  }
}

export async function POST(request: Request) {
  if (!isCronAuthorized(request) && !isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
  }

  const payload = parsePayload(body)
  if (!payload) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 })
  }

  try {
    after(async () => {
      try {
        await runInactivityWatch(payload)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Inactivity watch failed"
        console.error("[inactivity-watch]", message)
      }
    })
    return NextResponse.json({ ok: true, accepted: true, phase: payload.phase })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inactivity watch failed"
    console.error("[inactivity-watch]", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
