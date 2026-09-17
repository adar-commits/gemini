import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isDigitalDocumentRequest,
  shouldHandleDigitalDocumentFlow,
} from "@/lib/agents/digital-document-flow"
import { extractOrderNumber } from "@/lib/agents/order-lookup"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runStructuredDocumentPreTurn } from "@/lib/hom-agent/pre-turn"
import { executeFetchDigitalDocument } from "@/lib/hom-agent/tools/document"

/** Replay 532395022 / Merav — forwarded Weezmo SMS is order context, not document intake. */
const WEEZMO = `מסמך דיגיטלי | השטיח האדום
שלום יעל מושקוביץ, 👋
תודה על רכישתך בשטיח האדום, להלן קישור לקבלה הדיגיטלית שלך:
https://documents.carpetshop.co.il/documents/e342437f-1686-46b7-8250-24733dc1fc5d

למעקב אחר התקדמות ההזמנה, יש ללחוץ כאן:
https://tracking.carpetshop.co.il/track?orderID=SO26020101

נשמח לעמוד לרשותך בכל שאלה בערוצי הדיגיטל שלנו, תתחדשו ❤️
אין צורך להשיב להודעה זו`

const TYPE_MENU = `*הום בוט :)*
איזה סוג מסמך נדרש?
1. חשבונית מס
2. חשבונית מס קבלה
3. קבלה`

describe("forwarded Weezmo template 532395022", () => {
  it("does not treat the template as a document-copy request", () => {
    assert.equal(isDigitalDocumentRequest(WEEZMO), false)
    assert.equal(shouldHandleDigitalDocumentFlow(WEEZMO, []), false)
    assert.equal(extractOrderNumber(WEEZMO), "SO26020101")
    assert.equal(isDigitalDocumentRequest("אפשר לשלוח קבלה בבקשה?"), true)
  })

  it("hints order context instead of document intake", () => {
    const hints = buildConversationHints({
      body: WEEZMO,
      history: [],
      whatsappPhone: "+972505665518",
    })
    assert.match(hints ?? "", /FORWARDED WEEZMO TEMPLATE/)
    assert.match(hints ?? "", /SO26020101/)
    assert.doesNotMatch(hints ?? "", /DOCUMENT COPY \(קבלה/)
  })

  it("releases a mistaken type menu so the LLM can take a delivery follow-up", async () => {
    const history: HistoryMessage[] = [
      { role: "user", content: WEEZMO },
      { role: "assistant", content: TYPE_MENU },
    ]
    const body = "נדרש בירור צה קורה עם ההזמנה השטיח טרם הגיע"
    assert.equal(shouldHandleDigitalDocumentFlow(body, history), false)
    const preTurn = await runStructuredDocumentPreTurn({
      turn: { text: body, media: [] },
      history,
      phone: "+972505665518",
    })
    assert.equal(preTurn.kind, "skip")
    const tool = await executeFetchDigitalDocument({
      body,
      history,
      phone: "+972505665518",
    })
    assert.equal(tool.ok, false)
    if (tool.ok) return
    assert.equal(tool.errorCode, "document_misroute")
  })
})
