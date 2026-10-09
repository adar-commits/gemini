import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import {
  isBuyMeSalesOrderCallbackInquiry,
  isSalesTransferPromisedInLastAssistant,
} from "@/lib/agents/product-handoff"
import type { HistoryMessage } from "@/lib/agents/types"

const BUYME_ORDER_ASK =
  "אני רוצה להזמין שטיח ולשלם בבימי איך עושים?אפשר שנציג יתקשר אלי?"

const BAD_FIRST_REPLY =
  "*הום בוט :)* בשמחה שני! אפשר לשלם ב-BUYME גם באתר וגם בסניפים, ואפשר להשתמש בכמה שוברים באותה עסקה. רק שימי לב: לא ניתן לשלב BUYME עם חבר או מפעל הפיס. אני מעביר אותך עכשיו ליועץ מכירות. הוא יחזור אלייך למספר שממנו את כותבת (0524460247), יעזור לך לבחור את השטיח ויסגור איתך את התשלום ב-BUYME. אם כבר יש לך דגם או מידה בראש, אפשר לכתוב לי כאן ואעדכן את היועץ."

const BAD_HANDOFF_REPLY =
  "אני מעביר את הפרטים ליועץ מכירות. אם כבר יש לך מידה בראש, אפשר לכתוב לי אותה כאן. מעולה, העברתי את השיחה ליועץ מכירות. ניצור קשר בהקדם."

/** Replay 534528968 — BUYME order + callback must bind human_sales; one transfer line on handoff. */
describe("BUYME order callback handoff (534528968)", () => {
  it("detects new rug order with BUYME and phone callback ask", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "שלום" },
      {
        role: "assistant",
        content: "*הום בוט :)* שלום שני! 😊 במה אפשר לעזור?",
      },
    ]
    assert.equal(isBuyMeSalesOrderCallbackInquiry(BUYME_ORDER_ASK, history), true)
  })

  it("binds first-turn BUYME order + callback to human_sales in hints", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "שלום" },
      {
        role: "assistant",
        content: "*הום בוט :)* שלום שני! 😊 במה אפשר לעזור?",
      },
    ]
    const hints = buildConversationHints({
      history,
      body: BUYME_ORDER_ASK,
      whatsappPhone: "+972524460247",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /BUYME ORDER \+ CALLBACK \(534528968\)/)
    assert.match(hints!, /action: human_sales/)
    assert.match(hints!, /never `action: reply` alone/)
    assert.match(hints!, /one.*transfer line/i)
  })

  it("binds model follow-up after promised transfer to human_sales", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "שלום" },
      {
        role: "assistant",
        content: "*הום בוט :)* שלום שני! 😊 במה אפשר לעזור?",
      },
      { role: "user", content: BUYME_ORDER_ASK },
      { role: "assistant", content: BAD_FIRST_REPLY },
    ]
    assert.equal(isSalesTransferPromisedInLastAssistant(history), true)
    const hints = buildConversationHints({
      history,
      body: "שטיח סורה 02",
      whatsappPhone: "+972524460247",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /SALES TRANSFER PROMISED/)
    assert.match(hints!, /action: human_sales/)
    assert.match(hints!, /never both/i)
  })

  it("bad production first reply promised transfer without handoff action", () => {
    assert.match(BAD_FIRST_REPLY, /מעביר.*יועץ מכירות/)
    const boundAction = /מעביר.*יועץ מכירות/i.test(BAD_FIRST_REPLY)
      ? "human_sales"
      : "reply"
    assert.equal(boundAction, "human_sales")
  })

  it("bad production handoff duplicated transfer wording", () => {
    const transferCount =
      (BAD_HANDOFF_REPLY.match(/מעביר|העברתי/gi) ?? []).length
    assert.ok(transferCount >= 2, "expected duplicate transfer phrases to flag")
  })
})
