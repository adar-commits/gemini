import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isKnownOrderConfirmPending,
  orderIdGivenInThread,
  shouldBindKnownOrderTurn,
} from "@/lib/agents/order-lookup"
import {
  isLiveStatusCheckAffirmation,
  isLiveStatusCheckOfferPending,
} from "@/lib/hom-agent/live-status-check-offer"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const BOT_GREETING =
  "*הום בוט :)* היי עידו! במה אפשר לעזור? אם אתה כותב לגבי מועד האספקה של הזמנה SO26022951, אני יכול לבדוק לך עכשיו את הסטטוס העדכני."
const CONFIRM = "כן בבקשה"
const BAD_REPLY =
  "*הום בוט :)* בשמחה עידו לפי המידע האחרון שיש לנו, ההזמנה היא הזמנה מוקדמת של עלמה 02 חום 290*200, ועדיין לא נקבע במערכת תאריך לחידוש המלאי. כדי שתקבל צפi מדויק, אני מעביר עכשיו לנציג שירות שיבדוק את מועד האספקה של הזמנה SO26022951 ויחזור אליך. מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."

/** 532858826 — greeting status-check offer + כן בבקשה must lookup, not human_service. */
describe("live status check offer 532858826", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "היי" },
    { role: "assistant", content: BOT_GREETING },
  ]

  it("has SO in thread from bot greeting", () => {
    assert.equal(orderIdGivenInThread(history), "SO26022951")
  })

  it("detects live status offer — not mistaken order-card confirm", () => {
    assert.equal(isLiveStatusCheckOfferPending(history), true)
    assert.equal(isKnownOrderConfirmPending(history), false)
    assert.equal(isLiveStatusCheckAffirmation(CONFIRM), true)
    assert.equal(shouldBindKnownOrderTurn(CONFIRM, history), true)
  })

  it("hints lookup_order_status — not human_service before lookup", () => {
    const hints = buildConversationHints({ body: CONFIRM, history }) ?? ""
    assert.match(hints, /532858826/)
    assert.match(hints, /SO26022951/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /LIVE STATUS CHECK OFFER YES/)
    assert.doesNotMatch(hints, /human_service on this turn/i)
  })

  it("bad reply handed off without lookup_order_status tool path", () => {
    assert.match(BAD_REPLY, /מעביר.*נציג/)
    assert.match(BAD_REPLY, /העברתי את השיחה/)
  })
})
