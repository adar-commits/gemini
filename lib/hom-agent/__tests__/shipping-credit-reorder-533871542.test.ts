import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { classifyPostPurchaseCase } from "@/lib/agents/inquiry-intent"
import {
  DISSATISFACTION_RESCUE_MARKER,
  shouldBlockReturnOptionsForShippingStatus,
  shouldOfferReturnOptionsFirst,
} from "@/lib/agents/dissatisfaction"
import { hadOrderNumberLookupMissOnChannelPhoneInThread } from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runStructuredReturnOptionsPreTurn } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const OPENING =
  "היי מה נשמע ? רציתי לשאול לגביי המשלוח של השטיח הבנתי בחנות שהוא יגיע עד היום אבל לא קיבלתי הודעה על זה יש צפי ?"

const ORDER_CARD =
  "*הום בוט :)* מצאתי הזמנה שבוצעה לפני 10 ימים בבאר שבע, על סך 1,125 ש״ח. זו ההזמנה? (מס׳ הזמנה ⁦SO26024461⁩)"

const LOOKUP_MISS =
  "*הום בוט :)* לא מצאתי הזמנה ⁦SO26024461⁩ על המספר שבדקתי. האם להעביר לנציג שירות שיבדוק עבורכם?"

const CREDIT_EXPLAIN =
  "היה כמה הזמנות בגלל שחייבו אותנו ב11,125 והיה זיכוי ואז הזמנה חדשה"

const ETA_ONLY = "אני רק רוצה לדעת מתי השטיח מגיע"

const BAD_RETURN_MENU =
  "*הום בוט :)* היי! 👋 קיבלנו, יש שתי אפשרויות: 1. *החלפה* — ניתן להחליף לשטיח אחר שיתאים יותר"

/** Replay 533871542 — credit/reorder context on shipping thread must not open return menu. */
describe("shipping credit reorder context 533871542", () => {
  const historyThroughMiss: HistoryMessage[] = [
    { role: "user", content: OPENING },
    { role: "assistant", content: ORDER_CARD },
    { role: "user", content: "כן :)" },
    { role: "assistant", content: LOOKUP_MISS },
  ]

  it("detects channel-phone lookup miss after order confirm", () => {
    assert.equal(hadOrderNumberLookupMissOnChannelPhoneInThread(historyThroughMiss), true)
  })

  it("blocks return options after lookup miss on shipping thread", () => {
    assert.equal(
      shouldBlockReturnOptionsForShippingStatus(CREDIT_EXPLAIN, historyThroughMiss),
      true
    )
    assert.equal(shouldOfferReturnOptionsFirst(CREDIT_EXPLAIN, historyThroughMiss), false)

    const pre = runStructuredReturnOptionsPreTurn({
      turn: { text: CREDIT_EXPLAIN, media: [] },
      history: historyThroughMiss,
      phone: "+972522760519",
    })
    assert.equal(pre.kind, "skip")
  })

  it("credit explain may classify as return_request but must not offer menu", () => {
    assert.equal(classifyPostPurchaseCase(CREDIT_EXPLAIN), "return_request")
    assert.doesNotMatch(BAD_RETURN_MENU, /מתי השטיח מגיע/)
    assert.match(BAD_RETURN_MENU, new RegExp(DISSATISFACTION_RESCUE_MARKER))
  })

  it("hints stay on shipping ETA after reorder context", () => {
    const hints =
      buildConversationHints({ body: CREDIT_EXPLAIN, history: historyThroughMiss }) ?? ""
    assert.match(hints, /SHIPPING ETA \+ LOOKUP MISS \+ REORDER CONTEXT \(533871542\)/)
    assert.match(hints, /Never.*two-option/)
  })

  it("ETA restatement stays blocked from return menu", () => {
    const history: HistoryMessage[] = [
      ...historyThroughMiss,
      { role: "assistant", content: BAD_RETURN_MENU },
      { role: "user", content: ETA_ONLY },
    ]
    assert.equal(shouldOfferReturnOptionsFirst(ETA_ONLY, historyThroughMiss), false)
    assert.doesNotMatch(
      buildConversationHints({ body: ETA_ONLY, history }) ?? "",
      /RETURN OPTIONS FIRST/
    )
  })

  it("prompt teaches shipping reorder context is not return menu", () => {
    const line = prompt.split("\n").find((l) => l.includes("533871542"))
    assert.ok(line, "missing 533871542 shipping reorder rule")
    assert.match(line!, /Never.*two-option|Never.*exchange\+return/i)
  })
})
