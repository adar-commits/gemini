import { mediaMarker } from "@/lib/agents/multimodal"
import { CUSTOMER_HEADER } from "@/lib/agents/types"

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

export function turnHasVoiceMessage(turn: UserTurn) {
  return turn.media.some((part) => part.kind === "audio")
}

export function turnHasVideoMessage(turn: UserTurn) {
  return turn.media.some((part) => part.kind === "video")
}

export function buildVoiceMessageUnsupportedReply() {
  return `${CUSTOMER_HEADER}
מצטער, אני מודל AI ולא יכול להאזין להודעות קול. אפשר לכתוב/להקליד את הבקשה במקום?`
}

export function buildVideoMessageUnsupportedReply() {
  return `${CUSTOMER_HEADER}
מצטער, אני לא יכול לצפות בסרטונים. אפשר לכתוב בקצרה מה רצית, או לשלוח תמונה?`
}
