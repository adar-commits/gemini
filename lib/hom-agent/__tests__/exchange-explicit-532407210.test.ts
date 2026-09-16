import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildDissatisfactionRescueReply } from "@/lib/agents/dissatisfaction"
import {
  isExplicitExchangeExecutionTurn,
  isExchangeIntakeStartedInThread,
} from "@/lib/agents/exchange-intake"
import { isKbSelfServiceFaqThisTurn } from "@/lib/agents/kb-self-service-faq"
import { classifyPostPurchaseCase } from "@/lib/agents/inquiry-intent"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import {
  runStructuredExchangeExecutionPreTurn,
  runStructuredKbSelfServiceFaqPreTurn,
  runStructuredReturnOptionsPreTurn,
} from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const OPENING =
  "קיבלתי את השטיח ואני רוצה להחליף למידה 200*300"

/** Replay 532407210 — explicit החלפה must not get returns portal. */
describe("explicit exchange execution (532407210)", () => {
  it("classifies clear exchange request", () => {
    assert.equal(classifyPostPurchaseCase(OPENING), "exchange_request")
    assert.equal(isExplicitExchangeExecutionTurn(OPENING, []), true)
  })

  it("structured pre-turn starts exchange intake — no portal", () => {
    const result = runStructuredExchangeExecutionPreTurn({
      turn: { text: OPENING, media: [] },
      history: [],
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.match(result.reply, /נמשיך עם החלפה/)
    assert.doesNotMatch(result.reply, /returns\.carpetshop/)
    assert.doesNotMatch(result.reply, /החזרה וביטול/)
  })

  it("does not open return-options menu when exchange is already clear", () => {
    const result = runStructuredReturnOptionsPreTurn({
      turn: { text: OPENING, media: [] },
      history: [],
    })
    assert.equal(result.kind, "skip")
  })

  it("kb FAQ pre-turn skips exchange execution turns", async () => {
    const kb = runStructuredKbSelfServiceFaqPreTurn({
      turn: { text: OPENING, media: [] },
      history: [],
    })
    assert.equal(kb.kind, "skip")
    assert.equal(isKbSelfServiceFaqThisTurn(OPENING, []), false)
  })

  it("binds bare החלפה after two-option menu to exchange intake", () => {
    const history: HistoryMessage[] = [
      { role: "assistant", content: buildDissatisfactionRescueReply("+972532407210") },
    ]
    assert.equal(isExplicitExchangeExecutionTurn("החלפה", history), true)

    const result = runStructuredExchangeExecutionPreTurn({
      turn: { text: "החלפה", media: [] },
      history,
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.match(result.reply, /נמשיך עם החלפה/)
    assert.doesNotMatch(result.reply, /returns\.carpetshop/)
  })

  it("hints forbid portal on explicit exchange", () => {
    const hints = buildConversationHints({
      body: "החלפה",
      history: [
        { role: "assistant", content: buildDissatisfactionRescueReply("+972532407210") },
      ],
      phone: "0532407210",
    })
    assert.match(hints ?? "", /EXPLICIT EXCHANGE EXECUTION/i)
    assert.match(hints ?? "", /Never.*portal/i)
  })

  it("does not restart exchange intake once started", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: "*הום בוט :)*\nמעולה! נמשיך עם החלפה 😊",
      },
    ]
    assert.equal(isExchangeIntakeStartedInThread(history), true)
    const result = runStructuredExchangeExecutionPreTurn({
      turn: { text: "החלפה", media: [] },
      history,
    })
    assert.equal(result.kind, "skip")
  })
})
