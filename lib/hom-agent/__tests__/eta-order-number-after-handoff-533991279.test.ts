import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  extractOrderReference,
  isOrderNumberRequestPending,
  isShippingThreadFromHistory,
  wasOrderNumberRequestedInThread,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const BOT_ORDER_ASK =
  "*הום בוט :)*\nתודה איתן. כדי לאתר את ההזמנה בדיוק, יש לך מספר הזמנה מהמייל או מה-SMS של אישור ההזמנה? (למשל #36805)"
const BOT_INVOICE_HANDOFF =
  "*הום בוט :)*\nקיבלתי את החשבונית, תודה איתן מדובר בשטיח ניבה 01 קרם בז׳ 200*200 שהוזמן אתמול (4/10) באתר. מהתמונה אני לא יכול לראות את סטטוס המשלוח. חשוב לדעת: את מועד ההגעה המדויק חברת השליחויות מתאמת איתך בטלפון ביום האספקה עצמו. להעביר את הפנייה לנציג שירות שיבדוק את צפי האספקה של ההזמנה?"

/** 533991279 — ETA thread: order # after invoice ack + handoff offer must lookup, not human_service. */
describe("ETA order number after handoff offer 533991279", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "הי,מתי יגיע השטיח בבקשה" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי איתן! מדובר בהזמנה SO26024640 מקישור המעקב שקיבלת?",
    },
    { role: "user", content: "לא קיבלתי אישור מעקב" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* לא מצאתי את ההזמנה הנכונה ברשימה. קודם אמצא את ההזמנה שלכם בזריזות, האם היא רשומה על המספר ממנו אני מתכתב כרגע? (052-3285050) אם לא, אשמח לקבל אותו.",
    },
    { role: "user", content: "כן" },
    { role: "assistant", content: BOT_ORDER_ASK },
    {
      role: "user",
      content:
        "[תמונה][media:image:https://storage.googleapis.com/media.landbot.io/256062/customers/533740572/W0OF7Y8ZP6B102JVI6ZGSHTL2LHAGYC4.jpg]",
    },
    { role: "assistant", content: BOT_INVOICE_HANDOFF },
  ]
  const body = "78158 מספר הזמנה"

  it("detects shipping thread and earlier order-number ask, not pending on last turn", () => {
    assert.equal(isShippingThreadFromHistory(history), true)
    assert.equal(wasOrderNumberRequestedInThread(history), true)
    assert.equal(isOrderNumberRequestPending(history), false)
    assert.equal(extractOrderReference(body, history), "78158")
  })

  it("hints lookup_order_status — not human_service or generic ETA without tool", () => {
    const hints = buildConversationHints({ body, history }) ?? ""
    assert.match(hints, /533991279/)
    assert.match(hints, /78158/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /never generic ETA policy or human_service without running the tool/i)
  })
})
