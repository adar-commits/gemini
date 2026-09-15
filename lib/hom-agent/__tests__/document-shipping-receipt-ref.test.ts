import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isActiveDigitalDocumentFlow,
  isDigitalDocumentRequest,
  isReceiptReferencePresentation,
  resolveDigitalDocumentFlowReply,
  shouldDeferDocumentFlowToOrderLookup,
} from "@/lib/agents/digital-document-flow"
import { isPhoneLookupConfirmPending } from "@/lib/agents/order-lookup"
import {
  runStructuredDocumentPreTurn,
  runStructuredOrderLookupPreTurn,
} from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

/** Replay 530989504 / 0544981002 — pouf branch pickup, receipt ref, phone confirm loop. */
describe("document flow vs shipping receipt reference (530989504)", () => {
  const opening =
    "הי\nקניתי פופ לפני 10 ימים\nהיה אמור להגיע אליכם לסניף\nמה קורה עם זה?"

  const historyThroughPhoneConfirm: HistoryMessage[] = [
    { role: "user", content: opening },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nהיי, מבין שמדובר בפוף... אפשר לשלוח את מספר ההזמנה?",
    },
    { role: "user", content: "RC269019533" },
    { role: "user", content: "זה הקבלה" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nאיזה סוג מסמך נדרש?\n1. חשבונית מס\n2. חשבונית מס קבלה\n3. קבלה",
    },
    {
      role: "user",
      content: "לא קיבלתי את המוצר ולא יצרו קשר\nאת המוצר",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nהאם העסקה רשומה על המספר ממנו אני מתכתב כרגע? (054-4981002)\nאם לא, אשמח לקבל את המספר הנכון.",
    },
  ]

  it("does not treat זה הקבלה as a document copy request", () => {
    assert.equal(isReceiptReferencePresentation("זה הקבלה"), true)
    assert.equal(isDigitalDocumentRequest("זה הקבלה"), false)
  })

  it("defers mistaken document intake on shipping threads", () => {
    assert.equal(shouldDeferDocumentFlowToOrderLookup(historyThroughPhoneConfirm), true)
    assert.equal(isActiveDigitalDocumentFlow(historyThroughPhoneConfirm, "כן"), false)
    assert.equal(isActiveDigitalDocumentFlow(historyThroughPhoneConfirm, "כן!!"), false)
  })

  it("document pre-turn skips so LLM or order lookup can bind כן", async () => {
    const doc = await runStructuredDocumentPreTurn({
      turn: { text: "כן", media: [] },
      history: historyThroughPhoneConfirm,
      phone: "+972544981002",
    })
    assert.equal(doc.kind, "skip")

    const order = await runStructuredOrderLookupPreTurn({
      turn: { text: "כן", media: [] },
      history: historyThroughPhoneConfirm,
      phone: "+972544981002",
    })
    assert.equal(order.kind, "handled")
    assert.doesNotMatch(order.kind === "handled" ? order.reply : "", /לא הבנתי/)
    assert.equal(isPhoneLookupConfirmPending(historyThroughPhoneConfirm), true)
  })

  it("resolveDigitalDocumentFlowReply does not repeat phone confirm on shipping threads", async () => {
    const reply = await resolveDigitalDocumentFlowReply({
      body: "כן!!",
      phone: "+972544981002",
      history: historyThroughPhoneConfirm,
    })
    assert.match(reply, /לא\s+הבנתי/i)
    assert.doesNotMatch(reply, /האם\s+העסקה\s+רשומה/)
  })

  it("still treats explicit receipt copy requests as document flow", () => {
    assert.equal(isDigitalDocumentRequest("אפשר לשלוח קבלה בבקשה?"), true)
    assert.equal(isDigitalDocumentRequest("קבלה שלי"), true)
    assert.equal(isActiveDigitalDocumentFlow([], "אפשר לשלוח קבלה בבקשה?"), false)
  })
})
