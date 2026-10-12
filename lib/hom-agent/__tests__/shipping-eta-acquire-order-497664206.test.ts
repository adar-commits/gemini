import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { extractOrderNumber } from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const OPENING =
  "מתי אקבל את השטיח שרכשתי?\nהזמנה מס so26024433"

const BAD_REPLY =
  "*הום בוט :)* היי איריס, מצטער, יש כרגע תקלה זמנית במערכת ולא הצלחתי לראות את הסטטוס של הזמנה SO26024433. ביקשת קודם לדבר עם נציג, אז אני מעביר אותך עכשיו לנציג שירות."

/** 497664206 — SO + «מתי אקבל» must trigger lookup hints, not invented prior rep ask. */
describe("shipping eta acquire order 497664206", () => {
  const history: HistoryMessage[] = []

  it("extracts SO from delivery acquire opener", () => {
    assert.equal(extractOrderNumber(OPENING)?.toUpperCase(), "SO26024433")
  })

  it("hints ETA opener + order id lookup — never ביקשת קודם without handoff pending", () => {
    const hints = buildConversationHints({ body: OPENING, history }) ?? ""
    assert.match(hints, /497664206/)
    assert.match(hints, /ETA OPENER \+ ORDER ID/)
    assert.match(hints, /SO26024433/i)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /Never.*ביקשת קודם/i)
  })

  it("bad reply invented prior rep request on first-turn ETA ask", () => {
    assert.match(BAD_REPLY, /ביקשת קודם/)
    assert.match(BAD_REPLY, /מעביר/)
  })
})
