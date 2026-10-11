import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { classifyPostPurchaseCase } from "@/lib/agents/inquiry-intent"
import {
  isPhoneLookupConfirmPending,
  isPurePhoneLookupConfirmYes,
  isServiceLookupContext,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const WHATSAPP_PHONE = "+972523996704"

/** Replay 475968017 — defect + videos must not loop phone confirm after כן. */
describe("service fray phone loop (475968017)", () => {
  const opening =
    "היי. קנינו שטיח לפני כשנה בסניף אירפורטסיטי. השטיח מתחיל להיפרם במספר נקודות. מה עושים? תודה, קליין אביבית ועופר, צור 14 שוהם."

  const phoneAsk =
    "*הום בוט :)* קודם אמצא את ההזמנה שלכם בזריזות, האם היא רשומה על המספר ממנו אני מתכתב כרגע? (052-3996704) אם לא, אשמח לקבל אותו."

  const historyThroughPhoneAsk = (): HistoryMessage[] => [
    { role: "user", content: opening },
    { role: "assistant", content: phoneAsk },
  ]

  const historyAfterVideoCantWatch = (): HistoryMessage[] => [
    ...historyThroughPhoneAsk(),
    {
      role: "user",
      content:
        "[סרטון][media:video:https://storage.googleapis.com/media.landbot.io/256062/customers/475796770/NJWC0GDVZ69X9Z6FFOKSGEEG2SW7PYDS.mp4] [סרטון][media:video:https://storage.googleapis.com/media.landbot.io/256062/customers/475796770/HX2WOQP7295GFBS35N4U7629MJXHGL0S.mp4]",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מצטער, אני לא יכול לצפות בסרטונים. אפשר לכתוב בקצרה מה רצית, או לשלוח תמונה?",
    },
  ]

  it("phone confirm pending on defect opening", () => {
    const history = historyThroughPhoneAsk()
    assert.equal(classifyPostPurchaseCase(opening), "defect")
    assert.equal(isPhoneLookupConfirmPending(history), true)
    assert.equal(isServiceLookupContext(history), true)
    assert.equal(isPurePhoneLookupConfirmYes("כן"), true)
  })

  it("phone confirm still pending after video-decline bubble", () => {
    assert.equal(isPhoneLookupConfirmPending(historyAfterVideoCantWatch()), true)
  })

  it("binds SERVICE PHONE CONFIRM on כן — not another phone template", () => {
    const hints =
      buildConversationHints({
        body: "כן",
        history: historyThroughPhoneAsk(),
        whatsappPhone: WHATSAPP_PHONE,
      }) ?? ""
    assert.match(hints, /SERVICE PHONE CONFIRM \(475968017\)/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /Never repeat/)
  })

  it("binds video + phone pending hint after cannot-watch reply", () => {
    const body =
      "[סרטון][media:video:https://storage.googleapis.com/media.landbot.io/256062/customers/475796770/NJWC0GDVZ69X9Z6FFOKSGEEG2SW7PYDS.mp4]"
    const hints =
      buildConversationHints({
        body,
        history: historyAfterVideoCantWatch(),
        whatsappPhone: WHATSAPP_PHONE,
      }) ?? ""
    assert.match(hints, /SERVICE DEFECT VIDEO \+ PHONE PENDING \(475968017\)/)
  })

  it("binds defect detail after video — must lookup not re-ask phone", () => {
    const history: HistoryMessage[] = [
      ...historyAfterVideoCantWatch(),
      { role: "user", content: "מתחיל להיפרם" },
    ]
    const hints =
      buildConversationHints({
        body: "מתחיל להיפרם",
        history,
        whatsappPhone: WHATSAPP_PHONE,
      }) ?? ""
    assert.match(hints, /SERVICE PHONE CONFIRM \(475968017\)/)
    assert.match(hints, /lookup_order_status/)
  })
})
