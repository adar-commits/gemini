import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isShippingThreadFromHistory } from "@/lib/agents/order-lookup"
import { isThanksAcknowledgment } from "@/lib/agents/conversation-close"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

/** Replay 533476186 — thanks after service rep shipping update must not human_sales. */
describe("shipping service thanks close 533476186", () => {
  const history: HistoryMessage[] = [
    {
      role: "user",
      content:
        "היי אשמח לפרטים נוספים לגבי שטיח אטלס 22 קרם עם פרנזים ATLAS",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי! בשמחה, אשמח לעזור עם אטלס 22 קרם עם הפרנזים…",
    },
    {
      role: "user",
      content: "אני רוצה את הגודל לארג ואין באתר, אתה יודע להגיד לי אם זה יחזור?",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* … אני מעביר עכשיו ליועץ מכירות, והוא יחזור אליכם עם תשובה",
    },
    {
      role: "assistant",
      content:
        "שלום רוני גור, 👋 תודה על רכישתך בשטיח האדום… SO26023757",
    },
    { role: "user", content: "אבל לא הגיע השטיח....." },
    { role: "user", content: "???" },
    {
      role: "assistant",
      content: "היי רוני מדברת תהילה מהשירות לקוחות",
    },
    { role: "user", content: "היי תהילה מה נשמע" },
    {
      role: "assistant",
      content: "כן אני יודע שהשטיח שלך לא הגיע",
    },
    { role: "user", content: "מתי צפוי להגיע השטיח?" },
    {
      role: "assistant",
      content: "המשלוח שלך נמצא אצל חברת השליחויות",
    },
    {
      role: "assistant",
      content: "מנסה עכשיו לזרז לך את ההזמנה כמה שאני יכולה",
    },
  ]

  const body = "תודה רבה :)"

  it("detects shipping thread and thanks-only closing turn", () => {
    assert.equal(isShippingThreadFromHistory(history), true)
    assert.equal(isThanksAcknowledgment(body), true)
  })

  it("hints warm close on shipping service thread — never human_sales", () => {
    const hints = buildConversationHints({ body, history }) ?? ""
    assert.match(hints, /533476186/)
    assert.match(hints, /SHIPPING SERVICE THANKS CLOSE/i)
    assert.match(hints, /action: end/i)
    assert.match(hints, /never.*human_sales/i)
    assert.doesNotMatch(hints, /SALES RECAP \+ OPTIONAL PHOTO/)
    assert.doesNotMatch(hints, /human_sales NOW/)
  })
})
