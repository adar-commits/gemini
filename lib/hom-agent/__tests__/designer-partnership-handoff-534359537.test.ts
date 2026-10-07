import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import {
  isDesignerPartnershipInquiry,
  isSalesTransferPromisedInLastAssistant,
} from "@/lib/agents/product-handoff"
import type { HistoryMessage } from "@/lib/agents/types"

const DESIGNER_ASK =
  "אני מעצבת פנים רוצה לפנות אליכם לקחות איך אני משיגה הנחה ? מה תהליך"

const BAD_REPLY =
  "*הום בוט :)* איזה יופי, נעים להכיר! את פרטי שיתוף הפעולה וההנחות למעצבים נותן אצלנו יועץ מכירות, ואין לי כאן את התנאים המדויקים. לכן אני מעביר אותך עכשיו ליועץ מכירות שיסביר לך איך זה עובד. אם תרצi, אפשר לכתוב כאן בינתיים את שם הסטודיו ואם יש כבר פרויקט שאת עובדת עליו. ככה היועץ יגיע מוכן."

/** Replay 534359537 — designer partnership must bind human_sales when writing מעביר עכשיו. */
describe("designer partnership handoff (534359537)", () => {
  it("detects interior designer partnership inquiry", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "היי מה קורה" },
      {
        role: "assistant",
        content: "*הום בוט :)* היי! 😊 הכל טוב, תודה. במה אפשר לעזור?",
      },
    ]
    assert.equal(isDesignerPartnershipInquiry(DESIGNER_ASK, history), true)
  })

  it("binds first-turn designer partnership to human_sales in hints", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "היי מה קורה" },
      {
        role: "assistant",
        content: "*הום בוט :)* היי! 😊 הכל טוב, תודה. במה אפשר לעזור?",
      },
    ]
    const hints = buildConversationHints({
      history,
      body: DESIGNER_ASK,
      whatsappPhone: "+972500000000",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /DESIGNER PARTNERSHIP \(534359537\)/)
    assert.match(hints!, /action: human_sales/)
    assert.match(hints!, /never `action: reply` alone/)
  })

  it("binds studio-name follow-up after promised transfer to human_sales", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "היי מה קורה" },
      {
        role: "assistant",
        content: "*הום בוט :)* היי! 😊 הכל טוב, תודה. במה אפשר לעזור?",
      },
      { role: "user", content: DESIGNER_ASK },
      { role: "assistant", content: BAD_REPLY },
    ]
    assert.equal(isSalesTransferPromisedInLastAssistant(history), true)
    const hints = buildConversationHints({
      history,
      body: "שם הסטדיו \nRasha interior design",
      whatsappPhone: "+972500000000",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /SALES TRANSFER PROMISED \(533891498\)/)
    assert.match(hints!, /action: human_sales/)
  })

  it("bad production reply promised immediate sales transfer without handoff action", () => {
    assert.match(BAD_REPLY, /מעביר.*יועץ מכירות/)
    const boundAction = /מעביר.*יועץ מכירות/i.test(BAD_REPLY)
      ? "human_sales"
      : "reply"
    assert.equal(boundAction, "human_sales")
  })
})
