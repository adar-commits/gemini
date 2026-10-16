import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  classifyPostPurchaseCase,
  isDuplicateOrExtraItemComplaint,
} from "@/lib/agents/inquiry-intent"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const OPENING =
  "היי שלחתם לי בטעות 2 שטיחים במקום אחד .\nאתם מוזמנים לבוא לאסוף"

/** Replay 533508330 — wrong quantity + pickup offer must not merge old size/credit topics. */
describe("wrong quantity duplicate carpet (533508330)", () => {
  it("classifies mistaken double shipment as duplicate/extra service case", () => {
    assert.equal(isDuplicateOrExtraItemComplaint(OPENING), true)
    assert.equal(classifyPostPurchaseCase(OPENING), "missing_item")
  })

  it("emits duplicate hint forbidding history merge (size change / credit)", () => {
    const history: HistoryMessage[] = [
      {
        role: "user",
        content: "רציתי לשנות מידה ל-200*290 ולקבל זיכוי על ההפרש",
      },
      {
        role: "assistant",
        content: "*הום בוט :)*\nרשמתי את בקשת שינוי המידה והזיכוי.",
      },
    ]
    const hints = buildConversationHints({
      body: OPENING,
      history,
      whatsappPhone: "0506766677",
    })
    assert.match(hints, /DUPLICATE \/ EXTRA ITEM \(533672658 \/ 533508330\)/)
    assert.match(hints, /שינוי מידה/)
    assert.match(hints, /זיכוי/)
    assert.doesNotMatch(hints, /ORDER STATUS OPENING/)
  })
})
