import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isPhoneLookupConfirmPending,
  isPurePhoneLookupConfirmYes,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { VOICE_CLOSURE_TEMPLATE_BODY } from "@/lib/landbot/voice-closure-template"
import type { HistoryMessage } from "@/lib/agents/types"

const WHATSAPP = "+972521042555"

function history533478953(): HistoryMessage[] {
  return [
    { role: "user", content: "מחכה למשלוח של שטיח" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי! נבדוק איפה השטיח עומד. ההזמנה רשומה על מספר הטלפון שממנו מתכתבים כאן? אם יש מספר הזמנה (למשל #36805), אפשר לשלוח אותו ואאתר לפיו.",
    },
    { role: "assistant", content: VOICE_CLOSURE_TEMPLATE_BODY },
  ]
}

/** 533478953 — shipping wait + phone confirm כן after voice-callback template must stay on lookup, not handoff. */
describe("shipping phone confirm after voice template 533478953", () => {
  it("still detects phone confirm pending past the voice template", () => {
    assert.equal(isPhoneLookupConfirmPending(history533478953()), true)
    assert.equal(isPurePhoneLookupConfirmYes("כן"), true)
  })

  it("hints lookup_order_status on כן — never claim cannot show status without tool", () => {
    const hints =
      buildConversationHints({
        history: history533478953(),
        body: "כן",
        whatsappPhone: WHATSAPP,
      }) ?? ""
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /Never claim you cannot see status without running the tool/)
    assert.doesNotMatch(hints, /לא מצליח להציג/)
  })
})
