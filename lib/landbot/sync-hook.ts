import {
  createMessageHook,
  deleteMessageHook,
  listChannels,
  listMessageHooks,
} from "@/lib/landbot/client"

export function landbotWebhookUrl() {
  if (process.env.LANDBOT_WEBHOOK_URL?.trim()) {
    return process.env.LANDBOT_WEBHOOK_URL.trim()
  }
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (host) return `https://${host}/api/landbot/webhook`
  return "https://gemini-xi-one-77.vercel.app/api/landbot/webhook"
}

/** Base origin for internal cron/watch callbacks (no path). */
export function internalApiOrigin() {
  const webhook = landbotWebhookUrl()
  try {
    return new URL(webhook).origin
  } catch {
    return "https://gemini-xi-one-77.vercel.app"
  }
}

export function inactivityWatchUrl() {
  return `${internalApiOrigin()}/api/landbot/inactivity-watch`
}

export function landbotHookToken() {
  return (
    process.env.LANDBOT_WEBHOOK_TOKEN?.trim() ||
    process.env.AGENT_API_KEY?.trim() ||
    ""
  )
}

async function pickWhatsAppChannel() {
  const channels = (await listChannels()).channels ?? []
  const configured = process.env.LANDBOT_CHANNEL_ID?.trim()
  return (
    channels.find((item) => String(item.id) === configured) ??
    channels.find((item) => item.type === "whatsapp") ??
    channels[0] ??
    null
  )
}

export async function inspectMessageHooks() {
  const url = landbotWebhookUrl()
  const channels = (await listChannels()).channels ?? []
  const hooksByChannel = await Promise.all(
    channels.map(async (channel) => {
      const hooks = (await listMessageHooks(channel.id)).hooks ?? []
      return {
        channel: { id: channel.id, name: channel.name, type: channel.type },
        hooks: hooks.map((hook) => ({
          id: hook.id,
          url: hook.url,
          name: hook.name,
          matches_app_url: hook.url === url,
        })),
      }
    })
  )

  const registered = hooksByChannel.some((entry) =>
    entry.hooks.some((hook) => hook.matches_app_url)
  )

  return {
    webhook_url: url,
    hook_token_configured: Boolean(landbotHookToken()),
    registered,
    channels: hooksByChannel,
  }
}

/** Register or force-recreate the message hook with the current LANDBOT_WEBHOOK_TOKEN. */
export async function syncMessageHook(force = false) {
  const channel = await pickWhatsAppChannel()
  if (!channel) {
    throw new Error("No Landbot channel found. Set LANDBOT_CHANNEL_ID.")
  }

  const url = landbotWebhookUrl()
  const token = landbotHookToken()
  if (!token) {
    throw new Error("Set LANDBOT_WEBHOOK_TOKEN (or AGENT_API_KEY) before registering the hook.")
  }

  const existing = (await listMessageHooks(channel.id)).hooks ?? []
  const ours = existing.filter((hook) => hook.url === url)

  if (ours.length && !force) {
    return {
      created: false,
      recreated: false,
      channel,
      hook: ours[0],
      webhook_url: url,
      note:
        "Hook URL already registered in Landbot. If replies stopped after changing LANDBOT_WEBHOOK_TOKEN on Vercel, POST with {\"force\":true} to recreate the hook with the new token.",
    }
  }

  for (const hook of ours) {
    await deleteMessageHook(channel.id, hook.id)
  }

  const created = await createMessageHook(channel.id, {
    url,
    token,
    name: "HoM agents",
  })

  return {
    created: true,
    recreated: ours.length > 0,
    channel,
    hook: created.hook,
    webhook_url: url,
  }
}
