import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isActiveDigitalDocumentFlow,
  isDigitalDocumentRequest,
  shouldDeferDocumentFlowToOrderLookup,
  shouldHandleDigitalDocumentFlow,
} from "@/lib/agents/digital-document-flow"
import {
  extractOrderReference,
  isOrderReferencePresentation,
  isPhoneLookupConfirmPending,
  isPurePhoneLookupConfirmYes,
  resolveOrderShippingReply,
} from "@/lib/agents/order-lookup"
import {
  runStructuredDocumentPreTurn,
  runStructuredOrderLookupPreTurn,
} from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const PHONE = "+972504440304"

function historyThroughPhoneConfirm(): HistoryMessage[] {
  return [
    { role: "user", content: "אשמח לדבר עם מישהו לגביי האספקה בבקשה 🙏🏻" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nבשמחה אעזור בנושא האספקה\n\nכדי שאדע לבדוק בדיוק את הסטטוס, אתם מתכוונים להזמנה SO26022089 שנשלחה לכם קודם?",
    },
    {
      role: "user",
      content: "עשיתי הזמנה \nואני רוצה להבין מה תאריך האספקה המשוער",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nברור, אני מבין שרוצים לדעת מתי בערך ההזמנה צפויה להגיע.\n\nיש לכם מספר הזמנה (למשל SO26022089 או #76884)? אם לא, אפשר לבדוק לפי מספר הטלפון שממנו אתם כותבים.",
    },
    { role: "user", content: "IN264019998\nזה החשבונית" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nאיזה סוג חשבונית נדרש?\n1. חשבונית מס\n2. חשבונית מס קבלה",
    },
    { role: "user", content: "הזמנה #76705" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nהאם העסקה רשומה על המספר ממנו אני מתכתב כרגע? (050-4440304)\nאם לא, אשמח לקבל את המספר הנכון.",
    },
  ]
}

/** Replay 531770091 / 0504440304 — delivery lookup must not loop on document/phone confirm. */
describe("order lookup loop (531770091)", () => {
  it("treats IN on invoice line as order reference, not document copy", () => {
    const body = "IN264019998\nזה החשבונית"
    assert.equal(isOrderReferencePresentation(body), true)
    assert.equal(isDigitalDocumentRequest(body), false)
    const history = historyThroughPhoneConfirm().slice(0, 4)
    assert.equal(shouldDeferDocumentFlowToOrderLookup(history, body), true)
    assert.equal(shouldHandleDigitalDocumentFlow(body, history), false)
  })

  it("extracts Shopify-style order reference #76705", () => {
    assert.equal(extractOrderReference("הזמנה #76705", []), "76705")
  })

  it("binds phone confirm without requiring orderLookupStructuredBinding skip", async () => {
    const history = historyThroughPhoneConfirm()
    assert.equal(isPhoneLookupConfirmPending(history), true)
    assert.equal(isPurePhoneLookupConfirmYes("כן"), true)

    for (const body of ["כן", "כן זה המספר", "050-4440304"]) {
      assert.equal(
        isActiveDigitalDocumentFlow(history, body),
        false,
        `document flow must not block ${body}`
      )
      const doc = await runStructuredDocumentPreTurn({
        turn: { text: body, media: [] },
        history,
        phone: PHONE,
      })
      assert.equal(doc.kind, "skip", `document pre-turn must skip for ${body}`)

      const order = await runStructuredOrderLookupPreTurn({
        turn: { text: body, media: [] },
        history,
        phone: PHONE,
      })
      assert.equal(order.kind, "handled", `order pre-turn must handle ${body}`)
      assert.doesNotMatch(order.kind === "handled" ? order.reply : "", /לא הבנתי/)
    }
  })

  it("continues delivery question after phone confirm instead of re-asking phone", async () => {
    const history = historyThroughPhoneConfirm()
    const body = "מתי זמן אספקה משוער ?"
    const extendedHistory: HistoryMessage[] = [
      ...history,
      { role: "user", content: "כן" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nאוקיי נדמה לי שמצאתי את ההזמנה, בוצעה לפני 3 ימים… (מס׳ הזמנה SO26022089) נכון?",
      },
    ]
    const order = await runStructuredOrderLookupPreTurn({
      turn: { text: body, media: [] },
      history: extendedHistory,
      phone: PHONE,
    })
    assert.notEqual(order.kind, "skip")
    if (order.kind === "handled") {
      assert.doesNotMatch(order.reply, /האם העסקה רשומה על המספר/)
    } else {
      const reply = await resolveOrderShippingReply({
        body,
        phone: PHONE,
        history: extendedHistory,
      })
      assert.doesNotMatch(reply, /האם העסקה רשומה על המספר/)
    }
  })
})
