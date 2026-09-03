import { debugSessionLog } from "@/lib/debug/session-log"

const LANDBOT_API = "https://api.landbot.io/v1"

function authHeader() {
  const token = process.env.LANDBOT_API_TOKEN?.trim()
  if (!token) {
    throw new Error("Missing LANDBOT_API_TOKEN")
  }
  return token.startsWith("Token ") ? token : `Token ${token}`
}

async function landbotFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${LANDBOT_API}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  })

  const contentType = response.headers.get("content-type") ?? ""
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const detail =
      typeof payload === "string" ? payload.slice(0, 300) : JSON.stringify(payload)
    const error = new Error(`Landbot ${init.method ?? "GET"} ${path} failed (${response.status}): ${detail}`)
    ;(error as Error & { status: number }).status = response.status
    throw error
  }

  return payload as T
}

export async function getCustomer(customerId: number) {
  const payload = await landbotFetch<{
    success?: boolean
    customer?: { id?: number; phone?: string; name?: string }
  }>(`/customers/${customerId}/`)
  return payload.customer ?? null
}

export async function listChannels() {
  return landbotFetch<{ success: boolean; channels?: Array<{ id: number; name?: string; type?: string }> }>(
    "/channels/"
  )
}

export async function listMessageHooks(channelId: number) {
  return landbotFetch<{
    success: boolean
    hooks?: Array<{ id: number; url: string; name?: string; channel_id: number }>
  }>(`/channels/${channelId}/message_hooks/`)
}

export async function deleteMessageHook(channelId: number, hookId: number) {
  await landbotFetch(`/channels/${channelId}/message_hooks/${hookId}/`, {
    method: "DELETE",
  })
}

export async function createMessageHook(
  channelId: number,
  input: { url: string; token?: string; name?: string }
) {
  return landbotFetch<{ success: boolean; hook?: { id: number; url: string } }>(
    `/channels/${channelId}/message_hooks/`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  )
}

export async function assignToApiAgent(customerId: number) {
  try {
    await landbotFetch(`/customers/${customerId}/assign/`, { method: "PUT" })
  } catch (error) {
    const status = (error as Error & { status?: number }).status
    if (status !== 412) throw error
    await landbotFetch(`/customers/${customerId}/unassign/`, { method: "PUT" })
    await landbotFetch(`/customers/${customerId}/assign/`, { method: "PUT" })
  }
}

export async function unassignCustomer(customerId: number) {
  await landbotFetch(`/customers/${customerId}/unassign/`, { method: "PUT" })
}

export async function assignToHuman(customerId: number, agentId: number) {
  await landbotFetch(`/customers/${customerId}/assign/${agentId}/`, { method: "PUT" })
}

function splitWhatsApp(text: string) {
  const limit = 3500
  if (text.length <= limit) return [text]
  const chunks: string[] = []
  let rest = text
  while (rest.length) {
    chunks.push(rest.slice(0, limit))
    rest = rest.slice(limit)
  }
  return chunks
}

export async function sendCustomerText(customerId: number, message: string) {
  // #region agent log
  debugSessionLog({
    location: "client.ts:sendCustomerText",
    message: "landbot send_text",
    hypothesisId: "H2",
    data: {
      customerId,
      preview: message.slice(0, 80),
      length: message.length,
    },
  })
  // #endregion
  const chunks = splitWhatsApp(message)
  for (const chunk of chunks) {
    try {
      await landbotFetch(`/customers/${customerId}/send_text/`, {
        method: "POST",
        body: JSON.stringify({ message: chunk }),
      })
    } catch (error) {
      const status = (error as Error & { status?: number }).status
      if (status !== 412) throw error
      await assignToApiAgent(customerId)
      await landbotFetch(`/customers/${customerId}/send_text/`, {
        method: "POST",
        body: JSON.stringify({ message: chunk }),
      })
    }
  }
}
