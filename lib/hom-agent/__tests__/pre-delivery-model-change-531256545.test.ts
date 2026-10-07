import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isKbSelfServiceFaqThisTurn } from "@/lib/agents/kb-self-service-faq"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const OPENING = "היי אני רוצה להחליף דגם"

const BAD_FAQ_REPLY =
  "*הום בוט :)*\nהיי! בכיף, נמשיך עם החלפה. אפשר להחליף לדגם אחר בכל אחד מסניפי הרשת, או עם שליח (בתשלום לפי גודל השטיח), עד 14 יום מקבלת המוצר, כשהשטיח ללא שימוש ובאריזתו המקורית. מה לא התאים בדגם הנוכחי?"

/** Replay 531256545 — pre-delivery model change must not get post-receipt exchange FAQ on turn 1. */
describe("pre-delivery model change 531256545", () => {
  it("hints bind להחליף דגם on the opening turn", () => {
    const hints = buildConversationHints({
      body: OPENING,
      history: [] as HistoryMessage[],
      phone: "0509999907",
    })
    assert.match(hints ?? "", /531256545/)
    assert.match(hints ?? "", /ORDER MODIFICATION/)
  })

  it("keeps modification hints after pre-delivery clarification", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: OPENING },
      { role: "assistant", content: BAD_FAQ_REPLY },
    ]
    const followUp = "עוד לא קיבלתי אותו אני פשוט רוצה דגם אחר"
    const hints = buildConversationHints({
      body: followUp,
      history,
      phone: "0509999907",
    })
    assert.match(hints ?? "", /531256545/)
    assert.match(hints ?? "", /human_sales/i)
  })

  it("does not treat model-change opener as KB self-service exchange FAQ", () => {
    assert.equal(isKbSelfServiceFaqThisTurn(OPENING, []), false)
  })

  it("hints steer to lookup_order_status — not 14-day exchange policy", () => {
    const hints = buildConversationHints({
      body: OPENING,
      history: [] as HistoryMessage[],
      phone: "0509999907",
    })
    assert.match(hints ?? "", /531256545/)
    assert.match(hints ?? "", /lookup_order_status/i)
    assert.match(hints ?? "", /Never.*14 days|post-receipt exchange policy/i)
  })

  it("documents the wrong first-turn pivot to avoid", () => {
    assert.match(BAD_FAQ_REPLY, /14 יום מקבלת/)
    assert.match(BAD_FAQ_REPLY, /מה לא התאים/)
  })
})
