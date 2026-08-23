import { NextResponse } from "next/server"
import { isAuthorized } from "@/lib/agents/auth"
import {
  createMessageHook,
  listChannels,
  listMessageHooks,
} from "@/lib/landbot/client"

export const runtime = "nodejs"

function webhookUrl() {
  if (process.env.LANDBOT_WEBHOOK_URL?.trim()) {
    return process.env.LANDBOT_WEBHOOK_URL.trim()
  }
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (host) return `https://${host}/api/landbot/webhook`
  return "https://gemini-xi-one-77.vercel.app/api/landbot/webhook"
}

function hookToken() {
  return (
    process.env.LANDBOT_WEBHOOK_TOKEN?.trim() ||
    process.env.AGENT_API_KEY?.trim() ||
    ""
  )
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const channels = await listChannels()
    return NextResponse.json({
      ok: true,
      webhook_url: webhookUrl(),
      channels: channels.channels ?? [],
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

  try {
    const channels = (await listChannels()).channels ?? []
    const configured = process.env.LANDBOT_CHANNEL_ID?.trim()
    const channel =
      channels.find((item) => String(item.id) === configured) ??
      channels.find((item) => item.type === "whatsapp") ??
      channels[0]

    if (!channel) {
      return NextResponse.json(
        { ok: false, error: "No Landbot channel found. Set LANDBOT_CHANNEL_ID." },
        { status: 400 }
      )
    }

    const url = webhookUrl()
    const existing = (await listMessageHooks(channel.id)).hooks ?? []
    const already = existing.find((hook) => hook.url === url)
    if (already) {
      return NextResponse.json({
        ok: true,
        created: false,
        channel,
        hook: already,
        webhook_url: url,
      })
    }

    const created = await createMessageHook(channel.id, {
      url,
      token: hookToken() || undefined,
      name: "HoM agents",
    })

    return NextResponse.json({
      ok: true,
      created: true,
      channel,
      hook: created.hook,
      webhook_url: url,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Hook registration failed"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
