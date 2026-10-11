import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { hasExplicitRugDimensionsInText } from "@/lib/agents/sales-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const BAD_REPLY =
  "תודה, קיבלתי את התמונות — אעביר ליועץ העיצוב. לעתיד, תמונה אחת ברורה מספיקה"

/** 489989676 — pouf Garde L/XL sizing: room photos mid sales intake must not promise יועץ העיצוב. */
describe("sales sizing photo 489989676", () => {
  const history: HistoryMessage[] = [
    {
      role: "user",
      content: "היי אשמח להתייעץ לגבי מידה איך אפשר לדעת אם לארג או xl",
    },
    {
      role: "assistant",
      content:
        '*הום בוט :)* היי ענבל! בשמחה… כדי שיועץ המכירות יוכל לעזור לך לבחור בין L ל־XL, איזה דגם את בודקת ולאיזה חלל?',
    },
  ]

  const body =
    "גארדה לסלון\n" +
    "[media:image:https://storage.googleapis.com/media.landbot.io/256062/customers/489798113/VJ42M30K1YPG18BBF7LW8MUCLMCYTUWE.jpg]\n" +
    "[media:image:https://storage.googleapis.com/media.landbot.io/256062/customers/489798113/ABHREL3X0UW1IOHRBPTQMRIFU1RUQS94.jpg]"

  it("prompt teaches sales room photo ack without יועץ העיצוב", () => {
    const salesPhotoRule = prompt.match(
      /Sales intake room photo \(489989676\):[\s\S]*?(?=\n- \*\*)/
    )
    assert.ok(salesPhotoRule, "missing sales room photo rule")
    assert.match(salesPhotoRule![0], /קיבלתי את התמונה/)
    assert.doesNotMatch(salesPhotoRule![0], /אעביר ליועץ העיצוב/)
    assert.match(salesPhotoRule![0], /יועץ המכירות/)
  })

  it("does not treat Landbot image URLs as rug dimensions", () => {
    assert.equal(hasExplicitRugDimensionsInText(body), false)
    assert.equal(hasExplicitRugDimensionsInText("80*150"), true)
  })

  it("hints bind mid-intake room photos to sales advisor wording", () => {
    const hints = buildConversationHints({
      history,
      body,
      whatsappPhone: "+972544774776",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /SALES ROOM PHOTO \(489989676\)/)
    assert.match(hints!, /Never.*יועץ העיצוב/)
    assert.doesNotMatch(hints!, /אעביר ליועץ העיצוב/)
  })

  it("bad production reply promised design advisor mid-quiz", () => {
    assert.match(BAD_REPLY, /יועץ העיצוב/)
    assert.match(BAD_REPLY, /אעביר/)
  })
})
