import { NextResponse } from "next/server"
import {
  landbotPhonePolicy,
  shouldProcessPhone,
  shouldReplyPhone,
} from "@/lib/landbot/allowlist"
import { getCustomer } from "@/lib/landbot/client"
import { handleLandbotInbound } from "@/lib/landbot/handle-inbound"
import { claimInbound, releaseInbound } from "@/lib/landbot/inbound"
import {
  enqueueCustomerTurn,
  waitAndTakeBufferedTurn,
} from "@/lib/landbot/message-buffer"
import { isCustomerChat, parseLandbotWebhook } from "@/lib/landbot/parse-webhook"

export const maxDuration = 60
export const runtime = "nodejs"

function isHookAuthorized(request: Request) {
  const expected =
    process.env.LANDBOT_WEBHOOK_TOKEN?.trim() ||
    process.env.AGENT_API_KEY?.trim()
  if (!expected) return true

  const header = request.headers.get("authorization") ?? ""
  const value = header.replace(/^Token\s+/i, "").replace(/^Bearer\s+/i, "")
  return value === expected
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    method: "POST",
    note: "Landbot message hook. PROCESS phones run the agent; REPLY phones get WhatsApp answers. Bursts merge after ~3s silence.",
    policy: landbotPhonePolicy(),
  })
}

export async function POST(request: Request) {
  if (!isHookAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ ok: true, skipped: "invalid_json" })
  }

  const inbound = parseLandbotWebhook(payload, request.headers.get("sentry-trace"))
  if (!inbound || !isCustomerChat(inbound)) {
    return NextResponse.json({ ok: true, skipped: "not_customer_message" })
  }

  let phone = inbound.phone
  if (!phone) {
    const customer = await getCustomer(inbound.customerId).catch(() => null)
    phone = customer?.phone?.trim() || ""
  }
  if (!shouldProcessPhone(phone)) {
    return NextResponse.json({
      ok: true,
      skipped: "not_processed",
      phone: phone || null,
    })
  }

  const replyEnabled = shouldReplyPhone(phone)

  const claimed = await claimInbound(inbound.messageKey, inbound.conversationId)
  if (!claimed) {
    return NextResponse.json({ ok: true, skipped: "duplicate" })
  }

  try {
    const enqueuedAt = await enqueueCustomerTurn(
      inbound.conversationId,
      inbound.turn
    )
    const turn = await waitAndTakeBufferedTurn(inbound.conversationId, enqueuedAt)
    if (!turn) {
      return NextResponse.json({ ok: true, skipped: "debouncing" })
    }

    const result = await handleLandbotInbound(
      inbound.customerId,
      inbound.conversationId,
      turn,
      { replyEnabled, phone }
    )
    return NextResponse.json(result)
  } catch (error) {
    await releaseInbound(inbound.messageKey)
    const message = error instanceof Error ? error.message : "Landbot inbound failed"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
