import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildPostPurchaseAlternateSizeAdvisorReply,
  isPostPurchaseAlternateSizeAvailabilityQuestion,
  isPostPurchaseAlternateSizeThread,
  isPrePurchasePreOrderSalesInquiry,
} from "@/lib/agents/post-purchase-alt-size"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runStructuredPostPurchaseAltSizePreTurn } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

/** Replay 534753071 — pre-purchase pre-order ETA must not trigger post-purchase alt-size. */
describe("sales preorder ETA not alt-size (534753071)", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "היי" },
    { role: "user", content: "שטיח גארדה 03 קרם GARDA" },
    { role: "user", content: "במידה 2.4*3.4" },
    { role: "user", content: "אני רואה שאפשר לעשות בהזמנה מוקדמת באתר" },
    {
      role: "assistant",
      content:
        "היי מרים! גארדה 03 בצבע קרם, בשמחה. מה תרצי לדעת עליו? ולאיזה חלל השטיח מיועד, סלון, חדר שינה או חלל אחר?",
    },
  ]

  const body = "מתי אני אקבל אותו?"

  it("detects pre-purchase pre-order sales inquiry", () => {
    assert.equal(isPrePurchasePreOrderSalesInquiry(body, history), true)
  })

  it("does not classify as post-purchase alternate size", () => {
    assert.equal(
      isPostPurchaseAlternateSizeAvailabilityQuestion(body, history),
      false
    )
    assert.equal(isPostPurchaseAlternateSizeThread(history, body), false)
  })

  it("skips post-purchase alt-size pre-turn", () => {
    const preTurn = runStructuredPostPurchaseAltSizePreTurn({
      turn: { text: body, media: [] },
      history,
    })
    assert.equal(preTurn.kind, "skip")
  })

  it("adds sales pre-order hint, not POST-PURCHASE ALT SIZE", () => {
    const hints = buildConversationHints({ history, body })
    assert.ok(hints)
    assert.match(hints, /SALES PREORDER ETA \(534753071\)/)
    assert.doesNotMatch(hints, /POST-PURCHASE ALT SIZE/)
  })

  it("alt-size template text is not the expected reply shape", () => {
    assert.doesNotMatch(
      buildPostPurchaseAlternateSizeAdvisorReply(),
      /מתי אני אקבל/
    )
    assert.match(
      buildPostPurchaseAlternateSizeAdvisorReply(),
      /אותו דגם במידה אחרת/
    )
  })
})
