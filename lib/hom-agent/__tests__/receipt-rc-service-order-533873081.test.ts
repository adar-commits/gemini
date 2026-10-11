import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  classifyDocumentNumber,
  extractOrderReference,
  orderIdFromOrderConfirmationCard,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { isReceiptReferencePresentation } from "@/lib/agents/digital-document-flow"
import type { HistoryMessage } from "@/lib/agents/types"

describe("533873081 — RC receipt on partial-return service thread", () => {
  const history: HistoryMessage[] = [
    {
      role: "user",
      content:
        "קיבלתי את ההזמנה שלי מהשטיח האדום. אחד מהשלושה שטיחים הוא לא מה שהזמנתי והוא לא מתאים אשמח להחזיר אותו",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מצאתי הזמנה שבוצעה לפני 10 ימים בראשון לציון, על סך 1,535 ש״ח. זו ההזמנה? (מס׳ הזמנה SO26024464)",
    },
  ]

  const rcBody = "RC269022267 זה מספר הקבלה לא יודעת מה מספר ההזמנה"

  it("does not treat RC receipt id as a bare order reference", () => {
    assert.equal(classifyDocumentNumber(rcBody)?.id, "RC269022267")
    assert.equal(extractOrderReference(rcBody, history), null)
    assert.equal(isReceiptReferencePresentation(rcBody), true)
  })

  it("hints to use the SO already offered, not RC lookup failure", () => {
    assert.equal(orderIdFromOrderConfirmationCard(history), "SO26024464")
    const hints = buildConversationHints({ body: rcBody, history }) ?? ""
    assert.match(hints, /RECEIPT REF FOR NAMED ORDER/)
    assert.match(hints, /SO26024464/)
    assert.match(hints, /never with the RC number/)
  })
})
