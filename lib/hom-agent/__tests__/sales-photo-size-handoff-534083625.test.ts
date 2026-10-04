import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isActiveProductSalesPrepThread } from "@/lib/agents/product-handoff"
import { hasExplicitRugDimensionsInText } from "@/lib/agents/sales-intake"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

/** 534083625 — Sydney sales: photo + 80*150 mid-intake; bot said אעbיר but stayed reply and asked pets. */
describe("sales photo size handoff 534083625", () => {
  const history: HistoryMessage[] = [
    {
      role: "user",
      content: "היי אשמח לפרטים נוספים לגבי שטיח סידני 03 קרם-אפור SYDNEY",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nהיי מאיה! בשמחה, אעזור לך עם סידני 03 קרם-אפור. כדי שיועץ המכירות יחזור אלייך עם כל הפרטים, לאיזה חדר השטיח מיועד? סלון, חדר שינה, חדר ילדים או חדר אחר?",
    },
  ]

  const body =
    "אני רוצה שטיח בגודל 80*150 שיכסה את השבר הזה בפרקט ויש לי שטיח בחדר\n" +
    "[media:image:https://storage.googleapis.com/media.landbot.io/example.jpg]"

  it("detects explicit rug dimensions in customer text", () => {
    assert.equal(hasExplicitRugDimensionsInText("80*150"), true)
    assert.equal(hasExplicitRugDimensionsInText("רק תמונה"), false)
  })

  it("recognizes catalog product sales prep before the photo turn", () => {
    assert.equal(isActiveProductSalesPrepThread(history), true)
  })

  it("binds photo + size mid-intake to human_sales in hints", () => {
    const hints = buildConversationHints({
      history,
      body,
      whatsappPhone: "+972500000000",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /SALES PHOTO \+ SIZE \(534083625\)/)
    assert.match(hints!, /action: human_sales/)
    assert.match(hints!, /Never.*אעביר.*pets/is)
    assert.doesNotMatch(
      hints!,
      /SALES ROOM PHOTO:.*אעביר ליועץ העיצוב/s
    )
  })
})
