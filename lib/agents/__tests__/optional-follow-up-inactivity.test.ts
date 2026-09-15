import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildThanksAckReply,
  endsWithOptionalFollowUpOffer,
} from "@/lib/agents/conversation-close"
import { CUSTOMER_HEADER, ORDER_STATUS_HELP_OFFER } from "@/lib/agents/types"

/** Replay 531376724 / 0544240040 — ping after optional follow-up closing. */
describe("optional follow-up inactivity (531376724)", () => {
  it("detects order status help offer as optional follow-up", () => {
    const reply = `${CUSTOMER_HEADER}\nבדקתי, המשלוח בדרך.\n\n${ORDER_STATUS_HELP_OFFER}`
    assert.equal(endsWithOptionalFollowUpOffer(reply), true)
  })

  it("detects thanks ack wrap-up as optional follow-up", () => {
    const reply = buildThanksAckReply("Elad")
    assert.equal(endsWithOptionalFollowUpOffer(reply), true)
  })

  it("does not treat mandatory handoff offer as optional follow-up", () => {
    const reply = `${CUSTOMER_HEADER}\nהאם להעביר את הפנייה לנציג שירות?`
    assert.equal(endsWithOptionalFollowUpOffer(reply), false)
  })
})
