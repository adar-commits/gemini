import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { shouldIncludeMembershipPaymentsKb } from "@/lib/agents/kb"
import { isMembershipClubCheckoutQuestion } from "@/lib/agents/payment-intent"
import { validateHomAgentReply } from "@/lib/hom-agent/validate-reply"

describe("membership club checkout intent", () => {
  it("detects reloadable card complete-order ask (503927630)", () => {
    assert.equal(
      isMembershipClubCheckoutQuestion("מעוניינית להשלים הזמנה באמצעות כרטיס נטען"),
      true
    )
    assert.equal(shouldIncludeMembershipPaymentsKb("כרטיס נטען"), true)
  })

  it("detects named clubs from operator list", () => {
    assert.equal(isMembershipClubCheckoutQuestion("אפשר לשלם עם מועדון טוב?"), true)
    assert.equal(isMembershipClubCheckoutQuestion("יש תמיכה ב-iStudent?"), true)
    assert.equal(isMembershipClubCheckoutQuestion("לאומי בונוס"), true)
  })
})

describe("truncated membership payment reply repair", () => {
  it("repairs 503927630 cut-off and offers service handoff", () => {
    const result = validateHomAgentReply(
      {
        reply:
          '*הום בוט :)*\nהיי 😊 לגבי אמצעי תשלום — באתר אפשר לשלם בכרטיסי אשראי.\n\nלגבי כרטיס נטען ספציפי — אין לי מידע מדוי\\"',
        action: "reply",
      },
      "מעוניינית להשלים הזמנה באמצעות כרטיס נטען"
    )
    assert.doesNotMatch(result.reply, /אין לי מידע/)
    assert.doesNotMatch(result.reply, /\\"/)
    assert.match(result.reply, /להעביר לנציג שירות/)
  })
})
