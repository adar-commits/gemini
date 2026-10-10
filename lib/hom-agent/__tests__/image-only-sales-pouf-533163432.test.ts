import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

/** 533163432 — pouf sales thread; customer sent three photos with no caption. FAQ said "בלי טקסט / לא הצלחתי לראות". */
describe("image-only sales photos 533163432", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "היי, מעוניינת בפופים לסלון" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי חנה! בשמחה. כדי שיועץ המכירות יוכל להתאים — לאיזה חלל מדובר?",
    },
    { role: "user", content: "סלון" },
  ]

  const body = [
    "[תמונה][media:image:https://storage.googleapis.com/media.landbot.io/256062/customers/532913896/UF2U2W5AFP5B5Q00EJYF0ZPCDA2VCKUX.jpg]",
    "[תמונה][media:image:https://storage.googleapis.com/media.landbot.io/256062/customers/532913896/H8XGC7QAERS0X6NRQIZ1AATCCXB4O09E.jpg]",
    "[תמונה][media:image:https://storage.googleapis.com/media.landbot.io/256062/customers/532913896/7HILZLZYC76S3SISLHZ501W1WHXA4CPU.jpg]",
  ].join("\n")

  const badBotReply =
    "*הום בוט :)* בוקר טוב חנה! 😊 ההודעה הגיעה אליי בלי טקסט, ולא הצלחתי לראות מה שלחת. במה אפשר לעזור? אם זה בהמשך לפופים לסלון, אפשר לכתוב לי מה מעניין אותך."

  it("fires image-only hint during sales intake", () => {
    const hints = buildConversationHints({
      body,
      history,
      whatsappPhone: "+972500000000",
    })
    assert.match(hints ?? "", /IMAGE ONLY TURN \(533163432\)/)
    assert.match(hints ?? "", /Never.*no text/i)
    assert.match(hints ?? "", /קיבלתי את התמונות/)
  })

  it("documents the bad FAQ reply pattern from the incident", () => {
    assert.match(badBotReply, /בלי טקסט/)
    assert.match(badBotReply, /לא הצלחתי לראות/)
  })
})
