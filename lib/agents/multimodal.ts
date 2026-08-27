import type { UserMediaPart, UserTurn } from "@/lib/agents/user-turn"
import type { HistoryMessage } from "@/lib/agents/types"

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image"; image: URL }
  | { type: "file"; data: URL; mediaType: string }

const MIME: Record<UserMediaPart["kind"], string> = {
  image: "image/jpeg",
  audio: "audio/mpeg",
  video: "video/mp4",
  document: "application/octet-stream",
}

const MEDIA_URL_RE = /\[media:(image|audio|video|document):([^\]]+)\]/gi

export function mediaMarker(kind: UserMediaPart["kind"], url: string) {
  return `[media:${kind}:${url}]`
}

/** Extract recent media URLs embedded in history for re-injection. */
export function extractRecentMediaFromHistory(
  history: HistoryMessage[],
  limit = 3
): UserMediaPart[] {
  const found: UserMediaPart[] = []
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const message = history[i]
    if (message.role !== "user") continue
    const content = message.content
    let match: RegExpExecArray | null
    MEDIA_URL_RE.lastIndex = 0
    while ((match = MEDIA_URL_RE.exec(content)) !== null) {
      const kind = match[1] as UserMediaPart["kind"]
      const url = match[2]?.trim()
      if (!url) continue
      if (!found.some((item) => item.url === url)) {
        found.push({ kind, url })
      }
    }
    if (found.length >= limit) break
  }
  return found.slice(0, limit)
}

export function buildUserContent(
  turn: UserTurn,
  extraMedia: UserMediaPart[] = []
): string | ContentPart[] {
  const text = turn.text.trim()
  const parts: ContentPart[] = []

  if (text) parts.push({ type: "text", text })

  const mediaByUrl = new Map<string, UserMediaPart>()
  for (const item of [...extraMedia, ...turn.media]) {
    if (!mediaByUrl.has(item.url)) mediaByUrl.set(item.url, item)
  }

  for (const item of mediaByUrl.values()) {
    if (item.kind === "image") {
      parts.push({ type: "image", image: new URL(item.url) })
      continue
    }
    parts.push({
      type: "file",
      data: new URL(item.url),
      mediaType: MIME[item.kind],
    })
  }

  if (parts.length === 0) {
    return "[הודעה ללא טקסט]"
  }
  if (parts.length === 1 && parts[0].type === "text") {
    return parts[0].text
  }
  return parts
}

export function buildModelMessages(history: HistoryMessage[], turn: UserTurn) {
  const wantsPriorImage =
    /(?:כמו\s+ב(?:תמונה|צילום)|בתמונה\s+ש(?:שלחתי|צירפתי)|מה(?:ש)?(?:ראית|בתמונה))/i.test(
      turn.text
    )
  const extraMedia = wantsPriorImage ? extractRecentMediaFromHistory(history) : []

  return [
    ...history.map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    })),
    { role: "user" as const, content: buildUserContent(turn, extraMedia) },
  ]
}
