import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

const RETURN_PICKUP_OPENING =
  "אני ממתין גבר שבועיים שיאספו ממני שטיח שרציתי להחזיר"

describe("buildConversationHints", () => {
  it("guides return pickup wait without bypassing LLM", () => {
    const hints = buildConversationHints({
      history: [],
      body: RETURN_PICKUP_OPENING,
    })
    assert.ok(hints)
    assert.match(hints, /RETURN PICKUP WAIT/i)
    assert.match(hints, /lookup_order_status/i)
  })

  it("binds channel phone confirmation to order lookup", () => {
    const hints = buildConversationHints({
      history: [
        {
          role: "assistant",
          content:
            "*הום בוט :)*\nקודם אמצא את ההזמנה — האם היא רשומה על המספר ממנו אני מתכתב?",
        },
      ],
      body: "זה המספר טלפון שלי",
      whatsappPhone: "054-7495083",
    })
    assert.ok(hints)
    assert.match(hints, /lookup_order_status/i)
    assert.match(hints, /054-7495083/)
  })

  it("guides opening greetings warmly", () => {
    const hints = buildConversationHints({
      history: [],
      body: "היי",
    })
    assert.ok(hints)
    assert.match(hints, /OPENING GREETING/i)
    assert.match(hints, /😊/)
  })
})
