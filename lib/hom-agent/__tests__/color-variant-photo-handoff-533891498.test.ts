import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import {
  isColorVariantRealPhotoRequest,
  isSalesTransferPromisedInLastAssistant,
} from "@/lib/agents/product-handoff"
import type { HistoryMessage } from "@/lib/agents/types"

/**
 * 533891498 — Sydney 01 cream: customer hesitated between cream and cream-beige,
 * asked for real photos. Bot wrote "מעביר אותך עכשיו ליועץ מכירות" but action stayed reply.
 */
describe("color variant real photo handoff 533891498", () => {
  const openingBody =
    "אני רוצה להזמין את שטיח סידני שלכם ומתלבטת בין הגוון קרם לגוון קרם בז יש אפשרות להראות לי איך זה נראה במציאות בתמונה?"

  it("detects color variant real photo request on catalog inquiry", () => {
    const history: HistoryMessage[] = [
      {
        role: "user",
        content:
          "היי אשמח לפרטים נוספים לגבי שטיח סידני 01 קרם SYDNE\nשלום",
      },
    ]
    assert.equal(isColorVariantRealPhotoRequest(openingBody, history), true)
  })

  it("binds first-turn color photo request to human_sales in hints", () => {
    const history: HistoryMessage[] = [
      {
        role: "user",
        content:
          "היי אשמח לפרטים נוספים לגבי שטיח סידני 01 קרם SYDNE\nשלום",
      },
    ]
    const hints = buildConversationHints({
      history,
      body: openingBody,
      whatsappPhone: "+972500000000",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /COLOR VARIANT PHOTOS \(533891498\)/)
    assert.match(hints!, /action: human_sales/)
    assert.match(hints!, /crm_department: sales/)
    assert.match(hints!, /never `action: reply` alone/)
  })

  it("binds follow-up after promised transfer to human_sales", () => {
    const history: HistoryMessage[] = [
      {
        role: "user",
        content:
          "היי אשמח לפרטים נוספים לגבי שטיח סידני 01 קרם SYDNE\nשלום\n" +
          openingBody,
      },
      {
        role: "assistant",
        content:
          "*הום בוט :)* … מעביר אותך עכשיו ליועץ מכירות. … בקשה לתמונות אמיתיות …",
      },
    ]
    assert.equal(isSalesTransferPromisedInLastAssistant(history), true)
    const body =
      "אני רוצה שני שטיחים לסלון ולחדר השינה אולי לחדר השינה גם הבז יכול להיות אופציה\nסלון"
    const hints = buildConversationHints({
      history,
      body,
      whatsappPhone: "+972500000000",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /SALES TRANSFER PROMISED \(533891498\)/)
    assert.match(hints!, /action: human_sales/)
  })
})
