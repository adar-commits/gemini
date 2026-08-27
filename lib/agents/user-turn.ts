import { mediaMarker } from "@/lib/agents/multimodal"

export type UserMediaPart = {
  kind: "image" | "audio" | "video" | "document"
  url: string
  caption?: string
}

export type UserTurn = {
  text: string
  media: UserMediaPart[]
}

export function summarizeTurn(turn: UserTurn) {
  const mediaLines = turn.media.map((item) => {
    const label =
      item.kind === "image"
        ? "תמונה"
        : item.kind === "audio"
          ? "הודעת קול"
          : item.kind === "video"
            ? "סרטון"
            : "מסמך"
    const caption = item.caption ? `: ${item.caption}` : ""
    return `[${label}${caption}]${mediaMarker(item.kind, item.url)}`
  })
  return [turn.text.trim(), ...mediaLines].filter(Boolean).join("\n")
}

export function mergeTurns(turns: UserTurn[]): UserTurn {
  return {
    text: turns
      .map((turn) => turn.text.trim())
      .filter(Boolean)
      .join("\n"),
    media: turns.flatMap((turn) => turn.media),
  }
}
