import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { executeLookupOrderStatus } from "@/lib/hom-agent/tools/order-status"
import type { HistoryMessage } from "@/lib/agents/types"

describe("service summary confirmation guard", () => {
  it("blocks lookup tool when summary confirm is pending and user says כן", async () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nהבנתי שכבר פתחתם בקשת החזרה וממתינים שהשליח יגיע לאסוף את השטיח מהבית כבר 6 ימים.\n\nאז מסכם את הפנייה שלכם עבור נציג שירות הלקוחות שלנו:\n• מס׳ הזמנה: #76501\n• הלקוח ביקש להחזיר שטיח בהזמנה ונפתחה בקשת החזרה\n• נוצרה בקשת איסוף לחברת השליחויות\n\nאני צודק?",
      },
    ]

    const result = await executeLookupOrderStatus({
      body: "כן",
      phone: "+972547495083",
      history,
    })

    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.match(result.error, /Service handoff in progress/i)
    }
  })
})
