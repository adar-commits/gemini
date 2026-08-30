import { NextResponse } from "next/server"
import { landbotPhonePolicy, shouldProcessPhone, shouldReplyPhone } from "@/lib/landbot/allowlist"
import { normalizePhoneForOrderApi } from "@/lib/agents/order-lookup"
import { cronSecretStatus } from "@/lib/agents/cron-auth"
import {
  INACTIVITY_CLOSE_AFTER_PING_MS,
  INACTIVITY_PING_MS,
} from "@/lib/agents/inactivity"
import { getCustomer } from "@/lib/landbot/client"
import { handleLandbotInbound } from "@/lib/landbot/handle-inbound"
import { claimInbound, releaseInbound } from "@/lib/landbot/inbound"
import {
  enqueueCustomerTurn,
  waitAndTakeBufferedTurn,
} from "@/lib/landbot/message-buffer"
import { isCustomerChat, parseLandbotWebhook } from "@/lib/landbot/parse-webhook"

export const maxDuration = 300
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
  const { activeModelSummary } = await import("@/lib/agent-core/config")
  const models = await activeModelSummary()
  return NextResponse.json({
    ok: true,
    method: "POST",
    note: "Landbot message hook. Only LANDBOT_TRAINER_PHONE(S) run AI and receive WhatsApp replies. All other phones are skipped before any LLM call.",
    policy: landbotPhonePolicy(),
    models,
    runtimeConfig: "/api/agents/runtime-config",
    verifyInference: "/api/agents/verify-inference (GET=config, POST=live probe)",
    inactivity: {
      pingMs: INACTIVITY_PING_MS,
      closeAfterPingMs: INACTIVITY_CLOSE_AFTER_PING_MS,
      closeMechanism: "chained inactivity-watch after ping (+ /api/cron/conversation-idle backup)",
      cron: cronSecretStatus(),
    },
  })
}

export async function POST(request: Request) {
  if (!isHookAuthorized(request)) {
    console.error("landbot webhook unauthorized")
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
  if (phone) {
    const local = normalizePhoneForOrderApi(phone)
    if (/^0\d{9}$/.test(local)) {
      phone = `+972${local.slice(1)}`
    }
  } else {
    console.warn("[landbot-webhook] missing customer phone", {
      customerId: inbound.customerId,
    })
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
    await enqueueCustomerTurn(inbound.conversationId, inbound.turn)
    const turn = await waitAndTakeBufferedTurn(inbound.conversationId)
    if (!turn) {
      return NextResponse.json({ ok: true, skipped: "debouncing" })
    }

    const result = await handleLandbotInbound(
      inbound.customerId,
      inbound.conversationId,
      turn,
      {
        replyEnabled,
        phone,
        customerName: inbound.customerName,
      }
    )
    return NextResponse.json(result)
  } catch (error) {
    await releaseInbound(inbound.messageKey)
    const message = error instanceof Error ? error.message : "Landbot inbound failed"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
