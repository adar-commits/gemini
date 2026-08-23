import type { UserMediaPart, UserTurn } from "@/lib/agents/user-turn"

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

export function buildUserContent(turn: UserTurn): string | ContentPart[] {
  const text = turn.text.trim()
  const parts: ContentPart[] = []

  if (text) parts.push({ type: "text", text })

  for (const item of turn.media) {
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
