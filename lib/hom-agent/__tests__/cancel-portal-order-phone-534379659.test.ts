import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const CUSTOMER_BODY =
  "היי, עשינו הזמנה של שני שטיחים, אחד הגיע והשני לא היה במלאי, אמרו שיגיע רק בסוף ספטמבר. ניסינו להשיג אתכם מספר פעמים וגם השארנו הודעה באתר שלכם, אנחנו רוצים לבטל את ההזמנה של השטיח לולאות. ההזמנה על שם אהוד לי-הוד. טלפון 054-8183943. אנא התייחסותכם, אודי ושרון"

const WRONG_PORTAL_PHONE = "0544650942"
const ORDER_PHONE = "0548183943"

/** 534379659 — cancel partial order; portal used channel phone instead of customer-stated order phone. */
describe("cancel portal order phone 534379659", () => {
  const history: HistoryMessage[] = []

  it("hints to use customer-stated phone in returns portal when it differs from channel", () => {
    const hints = buildConversationHints({
      history,
      body: CUSTOMER_BODY,
      whatsappPhone: WRONG_PORTAL_PHONE,
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /CUSTOMER ORDER PHONE IN MESSAGE \(534379659\)/)
    assert.match(hints!, new RegExp(`\\?phone=${ORDER_PHONE}`))
    assert.match(hints!, /NOT the channel phone/)
  })

  it("no portal-phone hint when customer phone matches channel", () => {
    const hints = buildConversationHints({
      history,
      body: "רוצים לבטל, טלפון 054-8183943",
      whatsappPhone: ORDER_PHONE,
    })
    assert.notEqual(hints, null)
    assert.doesNotMatch(hints!, /CUSTOMER ORDER PHONE IN MESSAGE \(534379659\)/)
  })

  it("prompt teaches portal prefill from stated order phone", () => {
    const line = prompt.split("\n").find((l) => l.includes("Portal phone prefill") && l.includes("534379659"))
    assert.ok(line, "missing portal phone prefill rule")
    assert.match(line!, /returns\.carpetshop\.co\.il/)
    assert.match(line!, /stated phone/)
  })
})
