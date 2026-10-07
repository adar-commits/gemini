import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { isOrderCancellationSummaryLabel } from "@/lib/agents/service-intake"
import type { HistoryMessage } from "@/lib/agents/types"

/** 534295968 — cancel + refund + «לא קיבלתי קבלה» after document thread; bot wrote מעביר but action=reply. */
describe("cancel missing receipt handoff 534295968", () => {
  const cancelBody =
    "היי אני רוצה לבטל הזמנה ולקבל החזר ביצעתי אותה אתמול ולא קיבלתי שום קבלה"

  const documentThread: HistoryMessage[] = [
    {
      role: "user",
      content: "שילמנו על השטיח 999 מהחבר והיתר מהאשראי ולא קיבלנו שום קבלה חשבונית עסקה",
    },
    { role: "assistant", content: "*הום בוט :)* איזה סוג חשבונית נדרש?" },
    { role: "user", content: "חשבונית מס" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* האם העסקה רשומה על המספר ממנו אני מתכתב כרגע? (050-7310123)",
    },
    { role: "user", content: "כן" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* לא מצאתי מסמך דיגיטלי לפי הטלפון הזה. האם להעביר לנציג שירות שיבדוק וישלח עבורכם?",
    },
    { role: "user", content: "כן" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* כרגע אין נציגי שירות זמינים (שעות הפעילות א'-ה' 09:00-16:00), אבל אל דאגה — קיבלנו את הפנייה וניצור איתכם קשר מיד עם חזרת הצוות לזמינות.",
    },
    {
      role: "user",
      content: "היי מחכה לנציג שיחזור אליי שילמנו 1600 שקל על שטיח ולא קיבלנו שום קבלה",
    },
    { role: "user", content: "אני רוצה לבטל את ההזמנה" },
  ]

  it("detects cancel intent when missing receipt is mentioned", () => {
    assert.ok(isOrderCancellationSummaryLabel(cancelBody))
    assert.ok(isOrderCancellationSummaryLabel("לא קיבלנו שום קבלה ורוצים לבטל את ההזמנה"))
  })

  it("still excludes post-receipt cancel wording", () => {
    assert.equal(isOrderCancellationSummaryLabel("קיבלתי את השטיח ורוצה לבטל"), false)
  })

  it("hints pre-delivery cancel + human_service on the cancel turn", () => {
    const hints = buildConversationHints({
      history: documentThread,
      body: cancelBody,
      whatsappPhone: "0507310123",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /PRE-DELIVERY CANCEL OPENING \(348040437/)
    assert.match(hints!, /534295968/)
    assert.match(hints!, /action human_service/)
    assert.match(hints!, /Never action reply when you write מעביר/)
  })
})
