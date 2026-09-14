import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildDocumentAlreadyDeliveredReply,
  isActiveDigitalDocumentFlow,
  outboundDocumentDeliveryInThread,
  resolveDigitalDocumentFlowReply,
} from "@/lib/agents/digital-document-flow"
import { buildApiFailureReply } from "@/lib/agent-core/fallbacks"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import {
  runPreTurnGuards,
  runStructuredDocumentPreTurn,
} from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const OPENING =
  "הייהיי שלום ביצעתי הזמנה כרגע ולא קיבלתי קבלה / הודעה עם אישור ההזמנה \nההזמנה תחת שם לילי מסאלחה"

const PHONE_CONFIRM = `*הום בוט :)*
האם העסקה רשומה על המספר ממנו אני מתכתב כרגע? (050-5934944)
אם לא, אשמח לקבל את המספר הנכון.`

const ERP_TEMPLATE = `שלום לילי מסאלחה, 👋
תודה על רכישתך בשטיח האדום, להלן קישור לקבלה הדיגיטלית שלך:
https://documents.carpetshop.co.il/documents/f2e21614-fb0c-4f21-a35f-3631b34c3517

למעקב אחר התקדמות ההזמנה, יש ללחוץ כאן:
https://tracking.carpetshop.co.il/track?orderID=SO26022390

נשמח לעמוד לרשותך בכל שאלה בערוצי הדיגיטל שלנו, תתחדשו ❤️`

const WAIT_COPY = "*הום בוט :)*\nאני על זה, כמה רגעים בבקשה 🙏"

const FAILURE_HANDOFF = buildApiFailureReply()

function historyThroughFailure(): HistoryMessage[] {
  return [
    { role: "user", content: OPENING },
    { role: "assistant", content: PHONE_CONFIRM },
    { role: "user", content: "כן" },
    { role: "assistant", content: ERP_TEMPLATE },
    { role: "assistant", content: WAIT_COPY },
    { role: "assistant", content: FAILURE_HANDOFF },
  ]
}

describe("document ERP receipt loop (532321051 / 972505934944)", () => {
  it("detects automated receipt template in thread", () => {
    const history = historyThroughFailure()
    assert.equal(outboundDocumentDeliveryInThread(history), true)
  })

  it("binds כן אני אשמח to human_service after API failure handoff offer", () => {
    const result = runPreTurnGuards({
      turn: { text: "כן אני אשמח", media: [] },
      history: historyThroughFailure(),
    })

    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "human_service")
  })

  it("document pre-turn skips while handoff offer is pending", async () => {
    const result = await runStructuredDocumentPreTurn({
      turn: { text: "כן אני אשמח", media: [] },
      history: historyThroughFailure(),
      phone: "+972505934944",
    })

    assert.equal(result.kind, "skip")
  })

  it("does not re-ask phone after ERP receipt and confirmed phone", async () => {
    const history = historyThroughFailure()
    assert.equal(isActiveDigitalDocumentFlow(history, "כן"), false)

    const reply = await resolveDigitalDocumentFlowReply({
      body: "כן",
      phone: "+972505934944",
      history,
    })

    assert.doesNotMatch(reply, /האם\s+העסקה\s+רשומה/)
    assert.match(reply, /כבר נשלחה|תקלה זמנית/i)
  })

  it("already-delivered reply points to the template above", () => {
    assert.match(buildDocumentAlreadyDeliveredReply(), /בהודעה למעלה/)
  })

  it("hints not to restart document intake after ERP receipt", () => {
    const hints = buildConversationHints({
      history: historyThroughFailure(),
      body: "כן",
    })

    assert.ok(hints)
    assert.match(hints, /ERP RECEIPT ALREADY SENT/i)
  })
})
