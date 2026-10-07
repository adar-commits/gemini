import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  extractOrderReference,
  isOrderDeliveryStatusQuestion,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { VOICE_CLOSURE_TEMPLATE_BODY } from "@/lib/landbot/voice-closure-template"
import type { HistoryMessage } from "@/lib/agents/types"

/** 532250107 — «מה קורה עם השטיח שהיזמנתי» + SO in opener after voice template → lookup, not human_service. */
describe("rug status opener 532250107", () => {
  const history: HistoryMessage[] = [
    {
      role: "assistant",
      content:
        "שלום אסום חווה 👋, תודה על רכישתך בשטיח האדום, להלן קישור לקבלה הדיגיטלית שלך: https://documents.carpetshop.co.il/documents/67d563fa-b085-46ab-a07c-352dbda19ed2",
    },
    {
      role: "assistant",
      content:
        "שלום אסום חווה 👋, תודה על רכישתך בשטיח האדום, להלן קישור לחשבונית מס הדיגיטלית שלך: https://documents.carpetshop.co.il/documents/ebd90434-8c55-40a6-9707-c06819886f2f",
    },
    { role: "assistant", content: VOICE_CLOSURE_TEMPLATE_BODY },
  ]
  const body = "מה קורה עם השטיח שהיזמנתי הזמנה מס s026022324 תודה"

  it("extracts s0-prefixed order typo and order reference in opener", () => {
    assert.equal(isOrderDeliveryStatusQuestion(body), false)
    assert.equal(extractOrderReference(body, history), "SO26022324")
  })

  it("hints lookup_order_status — not human_service without lookup", () => {
    const hints = buildConversationHints({ body, history }) ?? ""
    assert.match(hints, /532250107/)
    assert.match(hints, /SO26022324/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /never.*human_service/i)
  })
})
