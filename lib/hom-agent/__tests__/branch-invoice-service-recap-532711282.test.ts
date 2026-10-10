import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const SUMMARY =
  "*הום בוט :)* תודה על התמונה… • מבקשים להחליף למידה שהוזמנה • טלפון: 054-8090870 זה מדויק, או שחסר משהו? אם יש מספר הזמנה, אפשר להוסיף אותו כאן."

const PHONE_MISS =
  "*הום בוט :)* לא מצאתי את ההזמנה OV265001396 על הטלפון (054-8090870). מה מספר הטלפון שבוצעה עליו ההזמנה?"

/** Replay 532711282 — wrong-size branch purchase: OV on service recap must not loop phone lookup. */
describe("branch invoice on service recap (532711282)", () => {
  const baseHistory: HistoryMessage[] = [
    {
      role: "user",
      content:
        "היי, השטיח החדש שסופק לא במידה הנכונה. קיבלנו 200*290 במקום 240*340",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מבין שהזמנתם 240*340 וסופק שטיח במידה 200*290. תמונה של התווית?",
    },
    { role: "user", content: "[media:image:https://example.com/label.jpg]" },
    { role: "assistant", content: SUMMARY },
  ]

  it("binds OV invoice on open service recap to human_service without phone miss", () => {
    const hints = buildConversationHints({
      history: baseHistory,
      body: "OV265001396",
      whatsappPhone: "+972548090870",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /BRANCH INVOICE ON SERVICE RECAP \(532711282\)/)
    assert.match(hints!, /human_service/)
    assert.match(hints!, /never.*לא מצאתי/i)
  })

  it("binds repeated channel phone after failed OV lookup to human_service", () => {
    const history: HistoryMessage[] = [
      ...baseHistory,
      { role: "user", content: "OV265001396" },
      { role: "assistant", content: PHONE_MISS },
    ]
    const hints = buildConversationHints({
      history,
      body: "0548090870",
      whatsappPhone: "+972548090870",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /SERVICE \+ SAME PHONE AFTER OV \(532711282\)/)
    assert.match(hints!, /human_service/)
  })

  it("production wrong pivot: phone miss after OV on defect thread", () => {
    assert.match(PHONE_MISS, /לא מצאתי/)
    assert.doesNotMatch(PHONE_MISS, /human_service/)
  })
})
