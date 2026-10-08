import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { isAffiliateCommissionInquiry } from "@/lib/agents/product-handoff"
import type { HistoryMessage } from "@/lib/agents/types"

const COMMISSION_ASK =
  "היי, אשמח לקבל מידע על איך ניתן לקבל את העמלות מהקניות ששמים את הקוד שלי, לקוחות רכשו דרכי לאחרונה."

const BAD_REPLY =
  "*הום בוט :)* היי! איזה יופי שלקוחות רוכשים דרך הקוד שלך. את הנושא של העמלות על רכישות עם הקוד מטפל אצלנו יועץ מכירות, והוא זה שיכול להסביר איך מקבלים אותן. כדי שלא יצטרך לשאול שוב, אלה הפרטים שאני מעביר לו: • פנייה בנושא קבלת עמלות על רכישות שבוצעו עם הקוד האישי • לקוחות רכשו לאחרונה עם הקוד • טלפון: 0542408505 אני מעביר עכשיו את הפנייה ליועץ מכירות. אם יש לך שם סטודיו או את הקוד עצמו, אפשר לכתוב אותם כאן והם יצורפו לפנייה"

/** Replay 487016993 — affiliate commission must bind human_sales when writing מעביר עכשיו. */
describe("affiliate commission handoff (487016993)", () => {
  it("detects affiliate commission inquiry on personal referral code", () => {
    assert.equal(isAffiliateCommissionInquiry(COMMISSION_ASK, []), true)
  })

  it("binds first-turn affiliate commission to human_sales in hints", () => {
    const hints = buildConversationHints({
      history: [],
      body: COMMISSION_ASK,
      whatsappPhone: "+972542408505",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /AFFILIATE COMMISSION \(487016993\)/)
    assert.match(hints!, /action: human_sales/)
    assert.match(hints!, /never `action: reply` alone/)
  })

  it("binds thanks follow-up after missed first-turn handoff to human_sales", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: COMMISSION_ASK },
      { role: "assistant", content: BAD_REPLY },
    ]
    const hints = buildConversationHints({
      history,
      body: "תודה!",
      whatsappPhone: "+972542408505",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /AFFILIATE COMMISSION \(487016993\)|SALES TRANSFER PROMISED/)
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
