import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isNumberedReturnPolicyChoicePending,
  isOrderLookupCompletedInThread,
  parseNumberedReturnPolicyChoice,
  requiresOrderIdentification,
  resolveOrderShippingReply,
} from "@/lib/agents/order-lookup"
import { buildReturnCancellationPolicyReply } from "@/lib/agents/policy-subjects"
import { executeLookupOrderStatus } from "@/lib/hom-agent/tools/order-status"
import {
  runStructuredOrderLookupPreTurn,
  runStructuredPostOrderCompletedPreTurn,
} from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const PHONE = "+972525991700"
/** 10:00 Israel — service reps online for deterministic handoff assertions. */
const BUSINESS_HOURS = new Date("2026-09-09T07:00:00.000Z")

function historyThroughReturnPolicy(): HistoryMessage[] {
  return [
    { role: "user", content: "ביטול עסקה" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\n" + buildReturnCancellationPolicyReply(PHONE),
    },
    { role: "user", content: "נציג שירות" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nקודם אמצא את ההזמנה שלכם בזריזות, האם היא רשומה על המספר ממנו אני מתכתב כרגע? (052-5991700)",
    },
    { role: "user", content: "כן" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nאוקיי נדמה לי שמצאתי את ההזמנה, בוצעה לפני 5 ימים… (מס׳ הזמנה SO26021506) נכון?",
    },
    { role: "user", content: "נכון" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nבדקתי, המשלוח סומן כנמסר נכון לתאריך 10/09/2026.\n\nאפשר לעזור במשהו נוסף?",
    },
    { role: "user", content: "ביטול עסקה" },
    {
      role: "assistant",
      content: "*הום בוט :)*\n" + buildReturnCancellationPolicyReply(PHONE),
    },
  ]
}

/** Replay 531159495 / 0525991700 — must not restart order lookup after cancel menu. */
describe("order cancel loop prevention (531159495)", () => {
  it("detects completed lookup in thread", () => {
    const history = historyThroughReturnPolicy()
    assert.equal(isOrderLookupCompletedInThread(history), true)
  })

  it("does not require order identification for menu choice or rep after lookup", () => {
    const history = historyThroughReturnPolicy()
    assert.equal(requiresOrderIdentification("2", history), false)
    assert.equal(requiresOrderIdentification("כן נציג שירות", history), false)
  })

  it("binds return policy menu choice 2 without phone re-ask", async () => {
    const history = historyThroughReturnPolicy()
    assert.equal(parseNumberedReturnPolicyChoice("2"), 2)
    assert.equal(isNumberedReturnPolicyChoicePending(history, "2"), true)

    const preTurn = await runStructuredPostOrderCompletedPreTurn({
      turn: { text: "2", media: [] },
      history,
      phone: PHONE,
    })
    assert.equal(preTurn.kind, "handled")
    if (preTurn.kind !== "handled") return
    assert.match(preTurn.reply, /returns\.carpetshop\.co\.il/)
    assert.doesNotMatch(preTurn.reply, /קודם אמצא/)
    assert.doesNotMatch(preTurn.reply, /האם היא רשומה על המספר/)
  })

  it("resolveOrderShippingReply does not restart phone lookup on menu 2", async () => {
    const history = historyThroughReturnPolicy()
    const reply = await resolveOrderShippingReply({
      body: "2",
      phone: PHONE,
      history,
    })
    assert.doesNotMatch(reply, /קודם אמצא/)
    assert.match(reply, /returns\.carpetshop\.co\.il/)
  })

  it("lookup tool returns portal path not phone confirm on menu 2", async () => {
    const history = historyThroughReturnPolicy()
    const result = await executeLookupOrderStatus({
      body: "2",
      phone: PHONE,
      history,
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.doesNotMatch(result.reply, /קודם אמצא/)
    assert.match(result.reply, /returns\.carpetshop\.co\.il/)
  })

  it("hands off on כן נציג שירות after order already found", async () => {
    const history = historyThroughReturnPolicy()
    const preTurn = await runStructuredPostOrderCompletedPreTurn({
      turn: { text: "כן נציג שירות", media: [] },
      history,
      phone: PHONE,
      now: BUSINESS_HOURS,
    })
    assert.equal(preTurn.kind, "handled")
    if (preTurn.kind !== "handled") return
    assert.equal(preTurn.action, "human_service")
    assert.match(preTurn.reply, /העברתי/)
    assert.doesNotMatch(preTurn.reply, /קודם אמצא/)
  })

  it("structured order pre-turn skips when lookup already completed", async () => {
    const history = historyThroughReturnPolicy()
    const order = await runStructuredOrderLookupPreTurn({
      turn: { text: "כן נציג שירות", media: [] },
      history,
      phone: PHONE,
    })
    assert.equal(order.kind, "skip")
  })
})
