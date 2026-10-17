import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isPhoneLookupConfirmPending,
  isPurePhoneLookupConfirmYes,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { shouldDeferStructuredPreTurnToLlm } from "@/lib/hom-agent/opening-turn-llm"
import type { HistoryMessage } from "@/lib/agents/types"

const PHONE = "+972526397888"

function historyThroughPhoneConfirm(): HistoryMessage[] {
  return [
    { role: "user", content: "היי אני יכולה משהו להוסיף להזמנה?" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי אמל! אפשרי לבדוק את זה. הוספה להזמנה קיימת נעשית דרך יועץ מכירות, והוא יבדוק אם אפשר לצרף אותה למשלוח של ההזמנה הנוכחית. מה תרצי להוסיף?",
    },
    {
      role: "user",
      content: "אם יש לכם גומי שניתן לשים מתחת לשטיח למנוע החלקה",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* קודם אמצא את ההזמנה שלכם בזריזות, האם היא רשומה על המספר ממנו אני מתכתב כרגע? (052-6397888) אם לא, אשמח לקבל אותו.",
    },
  ]
}

/** Replay 535214017 — add-to-order phone confirm must lookup, not human_service handoff. */
describe("add to order phone confirm (535214017)", () => {
  it("detects add-to-order thread from bot policy line", () => {
    const history = historyThroughPhoneConfirm()
    assert.equal(
      history.some(
        (m) =>
          m.role === "assistant" && m.content.includes("הוספה להזמנה קיימת")
      ),
      true
    )
  })

  it("binds bare כן to phone lookup, not LLM-only defer", () => {
    const history = historyThroughPhoneConfirm()
    assert.equal(isPhoneLookupConfirmPending(history), true)
    assert.equal(isPurePhoneLookupConfirmYes("כן"), true)
    assert.equal(
      shouldDeferStructuredPreTurnToLlm(history, { text: "כן", media: [] }),
      false
    )
  })

  it("hints lookup and sales handoff, not human_service", () => {
    const hints = buildConversationHints({
      body: "כן",
      history: historyThroughPhoneConfirm(),
      whatsappPhone: PHONE,
    })
    assert.match(hints ?? "", /535214017/)
    assert.match(hints ?? "", /lookup_order_status/)
    assert.match(hints ?? "", /human_sales/)
    assert.match(hints ?? "", /Never human_service/)
  })
})
