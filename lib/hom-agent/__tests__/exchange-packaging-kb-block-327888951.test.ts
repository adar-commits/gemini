import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { EXCHANGE_INTAKE_STARTED_MARKER } from "@/lib/agents/exchange-intake"
import { isKbSelfServiceFaqThisTurn } from "@/lib/agents/kb-self-service-faq"
import { runStructuredKbSelfServiceFaqPreTurn } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

/** Session 327888951 — courier exchange active; packaging update must not trigger policy FAQ pre-turn. */
describe("exchange packaging update blocks KB policy pre-turn (327888951)", () => {
  const openedPackagingUpdate =
    "פתחתי אותו והוא לא מתאים במידות וגלגלתי חזרה"

  const exchangeHistory: HistoryMessage[] = [
    {
      role: "assistant",
      content: `*הום בוט :)* מעולה, נמשיך עם החלפה עם שליח להזמנה #77790`,
    },
    { role: "user", content: "אני יכולה להחליף בסניף ללא עלות?" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* כן, בטח החלפה בכל אחד מסניפי הרשת היא ללא עלות. צריך להביא את השטיח ללא שימוש, באריזה המקורית.",
    },
  ]

  it("marks exchange intake started in thread", () => {
    assert.match(
      exchangeHistory[0]!.content,
      new RegExp(EXCHANGE_INTAKE_STARTED_MARKER)
    )
  })

  it("does not treat packaging clarification as KB self-service FAQ", () => {
    assert.equal(
      isKbSelfServiceFaqThisTurn(openedPackagingUpdate, exchangeHistory),
      false
    )
  })

  it("skips structured KB FAQ pre-turn during active exchange", () => {
    const preTurn = runStructuredKbSelfServiceFaqPreTurn({
      turn: { text: openedPackagingUpdate, media: [] },
      history: exchangeHistory,
    })
    assert.equal(preTurn.kind, "skip")
  })
})
