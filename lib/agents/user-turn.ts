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
  const labels: Record<UserMediaPart["kind"], string> = {
    image: "תמונה",
    audio: "הודעת קול",
    video: "סרטון",
    document: "מסמך",
  }
  const mediaLines = turn.media.map(
    (item) => `[${labels[item.kind]}${item.caption ? `: ${item.caption}` : ""}]`
  )
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
