import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isExchangeIntakeActive,
  needsExchangeKindQuestion,
} from "@/lib/agents/exchange-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const PHONE = "+972526272913"

/** Replay 532899816 — return opener + menu «1» (החלפה) must not route to service «בקשת החזרה» summary. */
function historyThroughOrderCardConfirm(): HistoryMessage[] {
  return [
    { role: "user", content: "אני רוצה להחזיר מוצר שקניתי" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* בשמחה אלי, נסדר את זה. יש שתי אפשרויות: 1. *החלפה* … 2. *החזרה וביטול* … מה מתאים לך יותר?",
    },
    { role: "user", content: "1" },
    {
      role: "assistant",
      content: "*הום בוט :)* מעולה, נמשיך עם החלפה ההחלפה היא על המוצר מהזמנה #77293?",
    },
    { role: "user", content: "כן" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* קודם אמצא את ההזמנה שלכם בזריזות, האם היא רשומה על המספר ממנו אני מתכתב כרגע? (052-6272913)",
    },
    { role: "user", content: "כן" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מצאתי הזמנה שבוצעה לפני 21 ימים באתר אינטרנט, על סך 520 ש״ח. זו ההזמנה? (מס׳ הזמנה #77293)",
    },
  ]
}

describe("exchange after return opener (532899816)", () => {
  it("exchange intake stays active despite early return wording", () => {
    const history = historyThroughOrderCardConfirm()
    assert.equal(isExchangeIntakeActive(history), true)
  })

  it("order-card כן gets exchange kind hint — not return pickup service summary", () => {
    const history = historyThroughOrderCardConfirm()
    const hints = buildConversationHints({
      body: "כן",
      history,
      phone: PHONE,
    })

    assert.match(hints ?? "", /EXCHANGE ORDER CONFIRM YES \(530876768 \/ 532899816\)/i)
    assert.match(hints ?? "", /A\/B\/C exchange-kind question/i)
    assert.doesNotMatch(hints ?? "", /RETURN PICKUP WAIT/i)
    assert.doesNotMatch(hints ?? "", /SERVICE ORDER ID \(505886895/i)
  })

  it("needs exchange kind question after order confirmed in thread", () => {
    const history: HistoryMessage[] = [
      ...historyThroughOrderCardConfirm(),
      { role: "user", content: "כן" },
      {
        role: "assistant",
        content: "*הום בוט :)* בדקתי את ההזמנה — נמשיך עם החלפה.",
      },
    ]
    assert.equal(needsExchangeKindQuestion(history), true)
  })
})
