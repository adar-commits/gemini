import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  customerRespondedToHandoffWithoutConfirm,
  isHumanHandoffPending,
} from "@/lib/agents/off-topic"
import {
  isOrderDeliveryStatusQuestion,
  isOrderLookupCompletedInThread,
  isShippingThreadFromHistory,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const ETA_OPENER = "מתי תגיע אליי הביתה?"
const FAQ_REPLY =
  "*הום בוט :)* כרגע ההזמנה בתהליכי אריזה במחסן, ולכן עדיין אין במערכת תאריך מסירה מדויק."
const OVERDUE_OFFER =
  "*הום בוט :)* במערכת אין לי זמן אספקה משוער. אם הזמן שהוצג לכם כבר עבר, כתבו לי כאן ואעביר לנציג שירות שיבדוק את ההזמנה שלכם"
const HANDOFF_OFFER =
  "*הום בוט :)* נציג שירות יכול לבדוק את זמן האספקה הצפוי להזמנה שלכם. להעביר אליו?"
const FINAL_ASK =
  "אמרו לי שבוע ועבר כבר אנחנו שניה לפני סופש אתה יכול לבדוק לי אם זה יכול להגיע היום?"
const BAD_REPLY =
  "*הום בוט :)* מבין, אמרו לכם שבוע והזמן הזה כבר עבר. לפי הבדיקה האחרונה ההזמנה עדיין בתהליכי אריזה במחסן, אז אני לא יכול להבטיח שהיא תגיע היום."

/** Replay 534443123 — overdue promise + check today after handoff offer must lookup, not blind human_service. */
describe("overdue shipping check 534443123", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: ETA_OPENER },
    { role: "assistant", content: FAQ_REPLY },
    { role: "user", content: "אתה יכול להגיד לי כמה זמן זה בערך לוקח?" },
    { role: "assistant", content: OVERDUE_OFFER },
    { role: "user", content: "איפה רואים בהזמנה בקבלה?" },
    { role: "assistant", content: HANDOFF_OFFER },
  ]

  it("detects shipping thread with non-confirm after handoff offer", () => {
    assert.equal(isShippingThreadFromHistory(history), true)
    assert.equal(isOrderLookupCompletedInThread(history), false)
    assert.equal(isHumanHandoffPending(history), false)
    assert.match(HANDOFF_OFFER, /להעביר אליו\?/)
    assert.equal(isOrderDeliveryStatusQuestion(FINAL_ASK), true)
  })

  it("hints lookup_order_status — not human_service before lookup", () => {
    const hints = buildConversationHints({ body: FINAL_ASK, history }) ?? ""
    assert.match(hints, /SHIPPING CHECK \(534443123\)|REPEAT ETA AFTER FAQ \(534111673\)/)
    assert.match(hints, /lookup_order_status/)
    assert.doesNotMatch(hints, /HANDOFF OFFER PENDING:/)
  })

  it("prompt teaches overdue promise + check today without lookup", () => {
    const line = prompt
      .split("\n")
      .find((l) => l.includes("534443123") && l.includes("Overdue promise"))
    assert.ok(line, "missing overdue promise + check today rule for 534443123")
    assert.match(line!, /lookup_order_status/)
    assert.match(line!, /human_service/)
  })

  it("bad production reply escalated without lookup or transfer wording", () => {
    assert.match(BAD_REPLY, /לא יכול להבטיח/)
    assert.doesNotMatch(BAD_REPLY, /מעביר|העברתי|בדקתי/)
  })
})
