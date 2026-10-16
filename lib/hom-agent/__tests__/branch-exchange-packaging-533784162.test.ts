import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isExchangeBranchChoiceReply,
  isExchangeBranchDifferentModelGuidanceComplete,
  isExchangeBranchPackagingFaqTurn,
  isExchangePolicyDeliveryMethodPending,
} from "@/lib/agents/exchange-intake"
import {
  buildPostPurchaseAlternateSizeAdvisorReply,
  isPostPurchaseAlternateSizeThread,
} from "@/lib/agents/post-purchase-alt-size"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runStructuredPostPurchaseAltSizePreTurn } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const BRANCH_MODEL_GUIDANCE =
  "*הום בוט :)* … אפשר להחליף לדגם אחר באותה מידה בסניף אין צורך בפורטל. מגיעים עם השטיח ללא שימוש ובאריזתו המקורית … בוחרים שם דגם אחר."

function historyThroughBranchChoice(): HistoryMessage[] {
  return [
    {
      role: "user",
      content:
        "שלום רב, רכשתי אצלכם לאחרונה וקיבלתי את השטיח היום. אני לא כלכך מרוצה מהצבע שלו, יש סיכוי להחליף אותו? (לשטיח אחר באותה המידה)",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* … נמשיך עם החלפה. איך נוח לכם יותר, בסניף או עם שליח?",
    },
  ]
}

function historyThroughPackagingAsk(): HistoryMessage[] {
  return [
    ...historyThroughBranchChoice(),
    { role: "user", content: "בסניף" },
    {
      role: "assistant",
      content: buildPostPurchaseAlternateSizeAdvisorReply(),
    },
    {
      role: "user",
      content: "לא, אני מעוניין להחליף את הדגם ולהישאר באותה מידה",
    },
    { role: "assistant", content: BRANCH_MODEL_GUIDANCE },
    { role: "user", content: "תודה רבה" },
    { role: "assistant", content: "*הום בוט :)* בשמחה!" },
    { role: "user", content: "מה קורה אם אין לי את האריזה המקורית?" },
  ]
}

/** Replay 533784162 — branch exchange + packaging FAQ must not trigger alt-size script. */
describe("branch exchange packaging (533784162)", () => {
  it("detects branch vs courier question including «איך נוח…»", () => {
    const history = historyThroughBranchChoice()
    assert.equal(isExchangePolicyDeliveryMethodPending(history), true)
  })

  it("binds «בסניף» to branch exchange, not alt-size pre-turn", () => {
    const history = historyThroughBranchChoice()
    const body = "בסניף"
    assert.equal(isExchangeBranchChoiceReply(body, history), true)
    assert.equal(isPostPurchaseAlternateSizeThread(history, body), false)
    const preTurn = runStructuredPostPurchaseAltSizePreTurn({
      turn: { text: body, media: [] },
      history,
    })
    assert.equal(preTurn.kind, "skip")
    const hints = buildConversationHints({ history, body }) ?? ""
    assert.match(hints, /EXCHANGE BRANCH CHOICE \(533784162\)/)
    assert.doesNotMatch(hints, /POST-PURCHASE ALT SIZE:/)
  })

  it("detects packaging FAQ after branch different-model guidance", () => {
    const history = historyThroughPackagingAsk().slice(0, -1)
    const body = "מה קורה אם אין לי את האריזה המקורית?"
    assert.equal(isExchangeBranchDifferentModelGuidanceComplete(history), true)
    assert.equal(isExchangeBranchPackagingFaqTurn(body, history), true)
    assert.equal(isPostPurchaseAlternateSizeThread(history, body), false)
    const hints = buildConversationHints({ history, body }) ?? ""
    assert.match(hints, /BRANCH EXCHANGE PACKAGING FAQ \(533784162\)/)
    assert.doesNotMatch(hints, /POST-PURCHASE ALT SIZE:/)
  })
})
