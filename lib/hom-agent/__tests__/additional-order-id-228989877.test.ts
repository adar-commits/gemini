import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  extractOrderReference,
  isOrderNumberRequestPending,
} from "@/lib/agents/order-lookup"
import {
  isAwaitingSalesIntakeAnswer,
  pendingSalesIntakeQuestionKind,
} from "@/lib/agents/sales-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

/** 228989877 — additional order lookup; bare order id must not bind to stale sales quiz → human_sales. */
describe("additional order id with stale sales intake 228989877", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "מחפש שטיח לסalon" },
    { role: "assistant", content: "*הום בוט :)* לאיזה חדר השטיח מיועד?" },
    { role: "user", content: "עוד הזמנה" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* בשמחה, נבדוק גם את ההזמנה הנוספת. רק לוודא, ההזמנה הזו רשומה על המספר 050-3727765, ותרצי לדעת מה סטטוס המשלוח שלה? אם יש לך גם מספר הזמנה (למשל #77871), אפשר לשלוח אותו.",
    },
    { role: "user", content: "כן תבדוק" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מצטער עינב, לא הצלחתי לשלוף כרגע את ההזמנה לפי המספר 050-3727765. יש לך את מספר ההזמנה? הוא מופיע בהודעת האישור או בחשבונית (למשל #77871). ברגע שתשלחי אותו, אמשיך לבדוק את הסטטוס.",
    },
  ]
  const body = "77684"

  it("extracts order id despite open sales quiz", () => {
    assert.equal(pendingSalesIntakeQuestionKind(history), "space")
    assert.equal(isAwaitingSalesIntakeAnswer(history), true)
    assert.equal(isOrderNumberRequestPending(history), true)
    assert.equal(extractOrderReference(body, history), "77684")
  })

  it("hints lookup_order_status — not human_sales or sales summary", () => {
    const hints = buildConversationHints({ body, history }) ?? ""
    assert.match(hints, /228989877/)
    assert.match(hints, /77684/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /NOT human_sales/)
  })
})
