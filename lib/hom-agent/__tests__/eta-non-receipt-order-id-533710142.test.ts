import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  buildOrderStatusReply,
  extractOrderReference,
  isOrderDeliveryStatusQuestion,
  mapPriorityOrderRow,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const OPENING =
  "יש לי הזמנה מספרה 77957. טרם הגיעה ואשמח לדעת מתי צפויה להגיע"
const BAD_REPLY =
  "*הום בוט :)*\nבדקתי, ההזמנה מסומנת כנמסרה ליעדה בהצלחה. שמחתי לעזור!"

/** Replay 533710142 — ETA + order # + non-receipt must not warm-close when status is delivered. */
describe("eta non-receipt order id 533710142", () => {
  const history: HistoryMessage[] = []

  it("detects order id and delivery ETA opener", () => {
    assert.equal(extractOrderReference(OPENING), "77957")
    assert.equal(isOrderDeliveryStatusQuestion(OPENING), true)
  })

  it("prompt teaches delivered + non-receipt gap on ETA opener with order #", () => {
    const line = prompt
      .split("\n")
      .find((l) => l.includes("533710142") && l.includes("533428072"))
    assert.ok(line, "missing ETA opener + non-receipt rule")
    assert.match(line!, /delivered/i)
    assert.match(line!, /never.*action: end/i)
    assert.match(line!, /שמחתי לעזור/)
  })

  it("hints lookup + gap acknowledgment — never warm-close on first turn", () => {
    const hints = buildConversationHints({ body: OPENING, history }) ?? ""
    assert.match(hints, /ETA OPENER \+ ORDER ID \(533428072 \/ 533710142/)
    assert.match(hints, /77957/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /never.*שמחתי לעזור/i)
    assert.match(hints, /delivered/i)
  })

  it("bad reply closed with delivered success instead of addressing non-receipt claim", () => {
    assert.match(BAD_REPLY, /נמסרה/)
    assert.match(BAD_REPLY, /שמחתי לעזור/)
    assert.doesNotMatch(BAD_REPLY, /איזה|מה הגיע|חסר|חוץ|סתירה/)
  })

  it("empty shipping status must not infer delivered from ORDSTATUSDES alone", () => {
    const order = mapPriorityOrderRow({
      ORDNAME: "SO26077957",
      REFERENCE: "#77957",
      ORDSTATUSDES: "הושלם",
      ZPIT_DELSTATUSCODE: null,
      ZPIT_DELSTATUSDES: null,
    })
    const reply = buildOrderStatusReply(order)
    assert.doesNotMatch(reply, /מסומנת כנמסרה/)
    assert.match(reply, /סטטוס ההזמנה במערכת: הושלם/)
  })
})
