import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isKnownOrderConfirmPending,
  orderIdGivenInThread,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const TRACKING_TEMPLATE =
  "למעקב אחר התקדמות ההזמנה, יש ללחוץ כאן: https://tracking.carpetshop.co.il/track?orderID=SO26025421"

const FAQ_EXPEDITE_REPLY =
  "*הום בוט :)* היי שרה לצערי אי אפשר לזרז משלוח להיום או לקבוע מראש מועד אספקה. חברת השליחויות יוצרת קשר ביום האספקה עצמו, לקראת ההגעה. קיבלת כבר חשבונית מס, כך שההזמנה בדרך אלייך. אפשר לעקוב אחרי ההתקדמות כאן: https://tracking.carpetshop.co.il/track?orderID=SO26025421 רוצה שאבדוק באיזה שלב ההזמנה נמצאת עכשיו?"

/** 534689508 — expedite → generic progress-check offer → warm כן must lookup SO from thread, not human_service. */
describe("expedite progress check confirm 534689508", () => {
  const history: HistoryMessage[] = [
    { role: "assistant", content: TRACKING_TEMPLATE },
    { role: "user", content: "אפשר לזרז לנו להיום?" },
    { role: "assistant", content: FAQ_EXPEDITE_REPLY },
  ]
  const body = "כן יקירה בבקשה ממך"

  it("finds SO on tracking link but not pending named-order confirm", () => {
    assert.equal(orderIdGivenInThread(history), "SO26025421")
    assert.equal(isKnownOrderConfirmPending(history), false)
  })

  it("hints lookup before handoff on warm affirm", () => {
    const hints = buildConversationHints({ body, history }) ?? ""
    assert.match(hints, /SHIPPING PROGRESS CHECK YES \(534689508\)/)
    assert.match(hints, /SO26025421/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /Never claim you cannot pull status/)
    assert.match(hints, /human_service only if lookup fails/)
  })
})
