import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildApiFailureReply,
  coerceOperationalReply,
  isHollowOrderStatusReply,
  isHollowTransferPromise,
} from "@/lib/agent-core/fallbacks"
import { CUSTOMER_HEADER } from "@/lib/agents/types"

describe("api failure fallbacks", () => {
  it("buildApiFailureReply offers service handoff with temporary-error wording", () => {
    const reply = buildApiFailureReply()
    assert.match(reply, /תקלה זמנית/)
    assert.match(reply, /האם להעביר לנציג שירות/)
  })

  it("detects hollow order status reply without delivery text", () => {
    const reply = `${CUSTOMER_HEADER}
לגבי הזמנה SO26019842 (אתר אינטרנט):


אם צריך עוד משהו — כאן. אפשר גם לכתוב נציג.`
    assert.equal(isHollowOrderStatusReply(reply), true)
  })

  it("coerceOperationalReply replaces hollow order status with API failure", () => {
    const hollow = `${CUSTOMER_HEADER}
לגבי הזמנה SO26019842 (אתר אינטרנט):


אם צריך עוד משהו — כאן.`
    const coerced = coerceOperationalReply(hollow)
    assert.match(coerced, /תקלה זמנית/)
  })

  it("detects hollow LLM transfer promise without handoff offer", () => {
    assert.equal(isHollowTransferPromise("מיד נעביר אותך לבדיקת סטטוס"), true)
    assert.equal(
      isHollowTransferPromise("האם להעביר לנציג שירות שיבדוק עבורך?"),
      false
    )
  })

  it("coerceOperationalReply replaces hollow transfer promise in shipping context", () => {
    const coerced = coerceOperationalReply("מיד נעביר אותך לבדיקה", {
      expectShippingData: true,
    })
    assert.match(coerced, /תקלה זמנית/)
  })
})
