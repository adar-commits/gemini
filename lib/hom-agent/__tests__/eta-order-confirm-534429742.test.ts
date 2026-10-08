import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  isOrderConfirmationPending,
  pendingOrderNumberFromHistory,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const ETA_ASK = "הכל בסדר. מתי אקבל את השטיח?"
const BOT_CARD =
  "*הום בוט :)*\nאני מצטער לשמוע, אנסה קודם לאתר את ההזמנה שלכם.. מצאתי הזמנה שבוצעה היום באתר אינטרנט, על סך 1,560 ש״ח. זו ההזמנה? (מס׳ הזמנה #78455)"
const CONFIRM = "כן. זו ההזמנה"
const BAD_REPLY =
  "*הום בוט :)*\nתודה מיכל\n\nההזמנה בוצעה היום, אז היא עכשיו בתחילת הטיפול. כרגע אין לי כאן תאריך אספקה מדויק להציג.\n\nאי אפשר לתאם מראש שעה מסוימת. חברת השליחויות יוצרת קשר ביום האספקה עצמו, לקראת ההגעה.\n\nתרצי שאעביר לנציג שירות שיבדוק את הצפi המדויק להזמנה #78455?"

/** Replay 534429742 — mid-thread «מתי אקבל» + «כן. זו ההזמנה» must lookup, not handoff. */
describe("eta order confirm 534429742", () => {
  const history: HistoryMessage[] = [
    {
      role: "user",
      content: "אם לא ארצה את השטיח לאחר שאקבל אותו אוכל לבטל את ההזמנה ללא עלות?",
    },
    { role: "assistant", content: "*הום בוט :)* היי מיכל! 😊 כן, אפשר לבטל..." },
    { role: "assistant", content: "*הום בוט :)* מיכל קינג, עדיין כאן?" },
    { role: "user", content: "כן." },
    {
      role: "assistant",
      content: "*הום בוט :)* מעולה מיכל קינג, אני כאן. איך אוכל להמשיך לעזור?",
    },
    { role: "user", content: ETA_ASK },
    { role: "assistant", content: BOT_CARD },
  ]

  it("detects mid-thread ETA ask and order-card confirm binding", () => {
    assert.equal(isOrderConfirmationPending(history), true)
    assert.equal(pendingOrderNumberFromHistory(history), "78455")
    assert.match(ETA_ASK, /מתי אקבל/)
    assert.match(CONFIRM, /כן.*זו ההזמנה/)
  })

  it("prompt teaches mid-thread ETA confirm lookup — no pre-lookup handoff", () => {
    const line = prompt.split("\n").find((l) => l.includes("534429742"))
    assert.ok(line, "missing mid-thread ETA + order confirm rule for 534429742")
    assert.match(line!, /lookup_order_status/)
    assert.match(line!, /מתי אקבל/)
  })

  it("hints lookup_order_status after כן. זו ההזמנה — not handoff offer", () => {
    const hints = buildConversationHints({ body: CONFIRM, history }) ?? ""
    assert.match(hints, /534429742/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /ETA policy/)
    assert.doesNotMatch(hints, /ORDER CONFIRM NO ISSUE STATED/)
  })

  it("bad reply offered human_service without lookup", () => {
    assert.match(BAD_REPLY, /אין לי כאן תאריך/)
    assert.match(BAD_REPLY, /תרצי שאעביר/)
    assert.doesNotMatch(BAD_REPLY, /בדקתי/)
  })
})
