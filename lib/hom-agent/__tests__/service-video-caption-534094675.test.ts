import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildUserContent } from "@/lib/agents/multimodal"
import { isBotFailureReply } from "@/lib/agent-core/fallbacks"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"
import { summarizeTurn, type UserTurn } from "@/lib/agents/user-turn"

const OPENING =
  "ישראל ערב טוב, הינה השטיח שאני מבקש לתקן ולנקות מידות רוחב - 1.19 מ׳"

const OPENING_IMAGES =
  `${OPENING}\n[media:image:https://storage.googleapis.com/media.landbot.io/256062/customers/533843820/N1EYEQ1SMSST1628EFMVT099J2VB6D3T.jpg]`

const VIDEO_BODY =
  "ישראל ערב טוב, הינה השטיח שמכרת לי היום במקומו בביתי. מה דעתך על השילוב עם השטיח הקיים?\n[סרטון: ישראל ערב טוב, הינה השטיח שמכרת לי היום במקומו בביתי. מה דעתך על השילוב עם השטיח הקיים?][media:video:https://storage.googleapis.com/media.landbot.io/256062/customers/533843820/TS0ICRACZFECSAH1K539CJ4T7GCID7JU.mp4]"

/** Replay 534094675 — video caption must not crash LLM (no video file part). */
describe("service video caption (534094675)", () => {
  const historyAfterOpening: HistoryMessage[] = [
    { role: "user", content: OPENING_IMAGES },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nערב טוב אמיתי, קיבלתי את התמונה ואת המידה (רוחב 1.19 מ׳). לגבי ניקוי, אצלנו אין שירות ניקוי שטיחים. לשטיח כזה מומלץ ניקוי יבש מקצועי. את התיקון אנחנו עושים רק לשטיחים של המותג שלנו. השטיח הזה נקנה אצלנו בשטיח האדום?",
    },
  ]

  const videoTurn: UserTurn = {
    text: "ישראל ערב טוב, הינה השטיח שמכרת לי היום במקומו בביתי. מה דעתך על השילוב עם השטיח הקיים?",
    media: [
      {
        kind: "video",
        url: "https://storage.googleapis.com/media.landbot.io/256062/customers/533843820/TS0ICRACZFECSAH1K539CJ4T7GCID7JU.mp4",
        caption:
          "ישראל ערב טוב, הינה השטיח שמכרת לי היום במקומו בביתי. מה דעתך על השילוב עם השטיח הקיים?",
      },
    ],
  }

  it("buildUserContent keeps caption text and omits video file parts", () => {
    const content = buildUserContent(videoTurn)
    assert.equal(typeof content, "string")
    assert.match(content as string, /מה דעתך על השילוב/)
    const serialized = JSON.stringify(content)
    assert.doesNotMatch(serialized, /video\/mp4/)
    assert.doesNotMatch(serialized, /TS0ICRACZFECSAH1K539CJ4T7GCID7JU/)
  })

  it("pre-turn skips video-only but not captioned video", () => {
    const captioned = runPreTurnGuards({ turn: videoTurn, history: historyAfterOpening })
    assert.equal(captioned.kind, "skip")

    const videoOnly = runPreTurnGuards({
      turn: {
        text: "",
        media: [{ kind: "video", url: "https://example.com/v.mp4" }],
      },
      history: [],
    })
    assert.equal(videoOnly.kind, "handled")
    assert.match(videoOnly.kind === "handled" ? videoOnly.reply : "", /לא יכול לצפות בסרטונים/)
  })

  it("binds VIDEO RECEIVED hint — not bot failure template", () => {
    const hints =
      buildConversationHints({ history: historyAfterOpening, body: VIDEO_BODY }) ?? ""
    assert.match(hints, /VIDEO RECEIVED \(534094675\)/)
    assert.match(hints, /cannot watch video/i)
    assert.doesNotMatch(hints, /PHOTO RECEIVED \(533695023/)
  })

  it("failure reply from incident is flagged as bot_failure", () => {
    const stuck =
      "*הום בוט :)*\nמשהו נתקע בצד שלי, סליחה על זה.\nאפשר לנסח שוב בקצרה, או להעביר את השיחה לנציג שירות שימשיך מכאן?"
    assert.equal(isBotFailureReply(stuck), true)
    assert.match(summarizeTurn(videoTurn), /\[media:video:/)
  })
})
