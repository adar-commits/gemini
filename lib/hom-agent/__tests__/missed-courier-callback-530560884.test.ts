import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  identifiedOrderNumberFromThread,
  isShippingThreadFromHistory,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const CUSTOMER_ASK =
  "אני צריכה ליצור קשר עם החברת שליחויות הוא התקשר אליי ואי אפשר לחזור אליו"
const SHIPPING_STATUS =
  "*הום בוט :)*\nלפי הסטטוס — ההזמנה נארזה וממתינה לאיסוף על ידי חברת השליחויות. השליח יתאם איתכם טלפונית את מועד האספקה — לא ניתן לקבוע תאריך מדויק מראש."
const ORDER_STATUS =
  "*הום בוט :)*\nבדקתי את ההזמנה. הזמנה מוקדמת משמעותה שהפריט לא היה במלאי כפי שצוין בעמוד ההזמנה, ולכן אנחנו מצפים לחידוש מלאי בסביבות 09/10/2026."

/** Replay 530560884 — missed courier call must not close with 077-9725055 only */
describe("missed courier callback 530560884", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "אשמח לדעת מתי מגיע השטיח שקניתי" },
    { role: "assistant", content: "האם היא רשומה על המספר ממנו אני מתכתב כרגע? (054-5221691)" },
    { role: "user", content: "כן" },
    { role: "assistant", content: "מצאתי הזמנה SO26020819. זו ההזמנה?" },
    { role: "user", content: "כן" },
    { role: "assistant", content: ORDER_STATUS },
    { role: "user", content: "היי יש צפי למשלוח?" },
    { role: "assistant", content: SHIPPING_STATUS },
  ]

  it("detects shipping thread and identified order", () => {
    assert.equal(isShippingThreadFromHistory(history), true)
    assert.ok(identifiedOrderNumberFromThread(history)?.includes("SO26020819"))
  })

  it("hints human_service — not action end with 077-9725055 self-service only", () => {
    const hints = buildConversationHints({ body: CUSTOMER_ASK, history }) ?? ""
    assert.match(hints, /MISSED COURIER CALLBACK \(530560884\)/)
    assert.match(hints, /human_service/)
    assert.match(hints, /Never action end with only 077-9725055/)
  })

  it("prompt teaches missed courier callback after shipping thread", () => {
    const line = prompt.split("\n").find((l) => l.includes("530560884"))
    assert.ok(line, "missing missed courier callback rule")
    assert.match(line!, /human_service/)
    assert.match(line!, /077-9725055 is not/)
  })
})
