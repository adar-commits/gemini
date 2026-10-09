import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import {
  isPrePurchaseModelDeliveryReturnInquiry,
  isSalesTransferPromisedInLastAssistant,
} from "@/lib/agents/product-handoff"
import type { HistoryMessage } from "@/lib/agents/types"

const CUSTOMER_ASK =
  "אני רוצה רגע לוודא על דגם מוניקה 03 ורוד כמה זמן אספקה יש עליו ואם יש מדיניות החזרים במידה והשטיח לא מתיישב לנו טוב בחלל"

const BAD_REPLY =
  "*הום בוט :)* היי מיכל, הכל טוב, תודה! זמן האספקה של מוניקה 03 ורוד תלוי במלאי של הדגם, ואין לי כאן נתון מדויק עליו. לכן אני מעביר אותך עכשיו ליועץ מכירות שיבדוק ויחזור אלייך."

/** Replay 534459893 — pre-purchase model ETA + return must bind human_sales when writing מעביר. */
describe("pre-purchase model delivery return handoff (534459893)", () => {
  it("detects named model pre-purchase delivery + return ask", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "היי" },
      { role: "user", content: "מה נשמע?" },
    ]
    assert.equal(
      isPrePurchaseModelDeliveryReturnInquiry(CUSTOMER_ASK, history),
      true
    )
  })

  it("binds first turn to human_sales in hints", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "היי" },
      { role: "user", content: "מה נשמע?" },
    ]
    const hints = buildConversationHints({
      history,
      body: CUSTOMER_ASK,
      whatsappPhone: "+972500000000",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /PRE-PURCHASE MODEL ETA \+ RETURN \(534459893\)/)
    assert.match(hints!, /action: human_sales/)
    assert.match(hints!, /never `action: reply` alone/)
  })

  it("binds follow-up after promised transfer to human_sales", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "היי" },
      { role: "user", content: CUSTOMER_ASK },
      { role: "assistant", content: BAD_REPLY },
    ]
    assert.equal(isSalesTransferPromisedInLastAssistant(history), true)
    const hints = buildConversationHints({
      history,
      body: "מחכה ליועץ",
      whatsappPhone: "+972500000000",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /SALES TRANSFER PROMISED \(533891498/)
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
