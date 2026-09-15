import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  classifyPostPurchaseCase,
  isBareReturnExecutionRequest,
} from "@/lib/agents/inquiry-intent"
import {
  buildDissatisfactionRescueReply,
  DISSATISFACTION_RESCUE_MARKER,
  resolveDissatisfactionRescueFollowUp,
  shouldOfferReturnOptionsFirst,
} from "@/lib/agents/dissatisfaction"
import { executeLookupOrderStatus } from "@/lib/hom-agent/tools/order-status"
import { runStructuredReturnOptionsPreTurn } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

describe("bare return opens with options before order lookup (508713127)", () => {
  it("classifies bare return as return_request", () => {
    assert.equal(classifyPostPurchaseCase("רוצה להחזיר את המוצר"), "return_request")
    assert.equal(isBareReturnExecutionRequest("רוצה להחזיר את המוצר"), true)
  })

  it("prefers dissatisfaction over return when both appear", () => {
    assert.equal(
      classifyPostPurchaseCase("קיבלתי את השטיח ולא אהבתי, רוצה להחזיר"),
      "dissatisfaction"
    )
  })

  it("prefers defect over return when both appear", () => {
    assert.equal(
      classifyPostPurchaseCase("יש פגם בשטיח, רוצה להחזיר"),
      "defect"
    )
  })

  it("pre-turn returns two-option rescue for bare return", () => {
    const result = runStructuredReturnOptionsPreTurn({
      turn: { text: "רוצה להחזיר את המוצר", media: [] },
      history: [],
      phone: "+972508713127",
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.match(result.reply, new RegExp(DISSATISFACTION_RESCUE_MARKER))
    assert.match(result.reply, /\*החלפה\*/)
    assert.doesNotMatch(result.reply, /מספר הזמנה/)
    assert.equal(result.action, "reply")
  })

  it("lookup tool refuses bare return before options were shown", async () => {
    const result = await executeLookupOrderStatus({
      body: "רוצה להחזיר את המוצר",
      phone: "+972508713127",
      history: [],
    })
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.match((result as { error: string }).error, /שתי אפשרויות/)
  })

  it("after options shown, return choice gets portal not lookup", () => {
    const history: HistoryMessage[] = [
      { role: "assistant", content: buildDissatisfactionRescueReply("+972508713127") },
    ]
    assert.equal(shouldOfferReturnOptionsFirst("רוצה להחזיר", history), false)
    assert.equal(
      resolveDissatisfactionRescueFollowUp("רוצה להחזיר את המוצר", "sales_offer"),
      "portal"
    )
    const result = runStructuredReturnOptionsPreTurn({
      turn: { text: "רוצה להחזיר את המוצר", media: [] },
      history,
      phone: "+972508713127",
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.match(result.reply, /returns\.carpetshop\.co\.il/)
  })

  it("after options shown, exchange choice starts intake not immediate sales", () => {
    const history: HistoryMessage[] = [
      { role: "assistant", content: buildDissatisfactionRescueReply() },
    ]
    assert.equal(
      resolveDissatisfactionRescueFollowUp("החלפה", "sales_offer"),
      "exchange_intake"
    )
    const result = runStructuredReturnOptionsPreTurn({
      turn: { text: "החלפה", media: [] },
      history,
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "reply")
    assert.match(result.reply, /נמשיך עם החלפה/)
    assert.doesNotMatch(result.reply, /מעביר/)
  })
})
