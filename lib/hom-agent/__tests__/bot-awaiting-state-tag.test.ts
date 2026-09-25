import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { normalizeBotAwaiting } from "@/lib/agents/bot-awaiting"
import { isHumanHandoffOfferPending, isHumanHandoffPending } from "@/lib/agents/off-topic"
import { isOrderConfirmationPending, isPhoneLookupConfirmPending } from "@/lib/agents/order-lookup"
import { isServiceHandoffSummaryPending } from "@/lib/agents/service-intake"
import { CUSTOMER_HEADER, type HistoryMessage } from "@/lib/agents/types"

const user = (content: string): HistoryMessage => ({ role: "user", content })
const bot = (content: string, awaiting?: HistoryMessage["awaiting"]): HistoryMessage => ({
  role: "assistant",
  content: `${CUSTOMER_HEADER}\n${content}`,
  ...(awaiting ? { awaiting } : {}),
})

/** Pending-state binding follows the stored tag, so the bot can phrase questions in its own words. */
describe("bot awaiting state tag", () => {
  it("binds a reworded handoff question by tag", () => {
    const history = [user("השטיח הגיע פגום"), bot("רוצים שנציג שירות יחזור אליכם עם זה?", "handoff_confirm")]
    assert.equal(isHumanHandoffOfferPending(history), true)
    assert.equal(isHumanHandoffPending(history), true)
  })

  it("does not treat the same reworded question as pending without a tag", () => {
    const history = [user("השטיח הגיע פגום"), bot("רוצים שמישהו מהצוות יחזור אליכם עם זה?")]
    assert.equal(isHumanHandoffOfferPending(history), false)
  })

  it("still detects legacy untagged wording", () => {
    const history = [user("השטיח הגיע פגום"), bot("האם להעביר לנציג שירות?")]
    assert.equal(isHumanHandoffOfferPending(history), true)
  })

  it("binds reworded order and phone confirms by tag", () => {
    assert.equal(
      isOrderConfirmationPending([user("איפה ההזמנה?"), bot("מצאתי הזמנה מלפני שבוע בסניף ראשון — זו היא?", "order_confirm")]),
      true
    )
    assert.equal(
      isPhoneLookupConfirmPending([user("איפה ההזמנה?"), bot("ההזמנה על המספר שממנו כתבתם?", "order_phone_confirm")]),
      true
    )
  })

  it("binds a reworded service summary by tag", () => {
    const history = [user("יש כתם"), bot("רק לוודא שהבנתי: כתם על השטיח מהזמנה 12345. נכון?", "service_summary_confirm")]
    assert.equal(isServiceHandoffSummaryPending(history), true)
  })

  it("skips inactivity pings when reading the tag", () => {
    const history = [
      user("השטיח הגיע פגום"),
      bot("רוצים שנציג שירות יחזור אליכם עם זה?", "handoff_confirm"),
      bot("עדיין כאן? 🙂"),
    ]
    assert.equal(isHumanHandoffOfferPending(history), true)
  })

  it("a different tag does not bind", () => {
    const history = [user("איפה ההזמנה?"), bot("ההזמנה על המספר שממנו כתבתם?", "order_phone_confirm")]
    assert.equal(isHumanHandoffOfferPending(history), false)
    assert.equal(isOrderConfirmationPending(history), false)
  })

  it("normalizes unknown values to null", () => {
    assert.equal(normalizeBotAwaiting("handoff_confirm"), "handoff_confirm")
    assert.equal(normalizeBotAwaiting("something"), null)
    assert.equal(normalizeBotAwaiting(undefined), null)
  })
})
