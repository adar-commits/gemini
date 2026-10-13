import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isExchangePolicyFaqPackagingPending,
} from "@/lib/agents/exchange-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const BAD_REPLY =
  "לפי המדיניות מחזירים את השטיח באריזה המקורית… אני מעביר אותך עכשיו ליועץ מכירות."

function historyThroughPlasticWrapAsk(): HistoryMessage[] {
  return [
    {
      role: "user",
      content: "היי רציתי לדעת אם ניתן להחליף שטיח שכבר הגיע אליי?",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* כן, אפשר להחליף. ההחלפה אפשרית עד 14 יום מקבלת השטיח, כשהוא ללא שימוש ובאריזתו המקורית.",
    },
    { role: "user", content: "פתחנו אותו אבל הוא לא היה בשימוש" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* זה בסדר שפתחתם. מה שחשוב… שאתם מחזירים אותו ארוז באריזה המקורית (או באריזה סגורה באיכות לא פחותה ממנה).",
    },
    { role: "user", content: "אפשר להחזיר אותו בניילון שאני אעטוף?" },
  ]
}

/** Replay 533890206 — FAQ exchange + plastic wrap → מעביר must bind human_sales, not reply. */
describe("exchange packaging FAQ handoff (533890206)", () => {
  it("detects FAQ packaging follow-up without exchange intake marker", () => {
    const history = historyThroughPlasticWrapAsk()
    assert.equal(isExchangePolicyFaqPackagingPending(history.slice(0, -1)), true)
  })

  it("emits packaging barrier hint with human_sales binding for 533890206", () => {
    const history = historyThroughPlasticWrapAsk()
    const body = history.at(-1)?.content ?? ""
    const hints = buildConversationHints({ history: history.slice(0, -1), body }) ?? ""
    assert.match(hints, /533890206/)
    assert.match(hints, /human_sales/)
    assert.match(hints, /never.*action: reply/i)
  })

  it("the bad turn promised sales transfer with reply action only", () => {
    assert.match(BAD_REPLY, /מעביר.*יועץ מכירות/i)
    const action = "reply"
    assert.notEqual(action, "human_sales")
  })
})
