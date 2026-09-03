import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  classifyPostPurchaseCase,
  isActiveReturnExchangePickupCase,
  isPostPurchaseDissatisfaction,
  isReturnEligibilityQuestion,
  isReturnPolicyQuestion,
} from "@/lib/agents/inquiry-intent"
import { buildDissatisfactionRescueReply } from "@/lib/agents/dissatisfaction"
import { isShippingStatusQuestion } from "@/lib/agents/shipping"
import { isFaqPolicyQuestion } from "@/lib/agents/policy-subjects"
import { isServiceTopicSwitch } from "@/lib/agents/topic-switch"
import {
  isOrderConfirmationYes,
  isServiceLookupContext,
} from "@/lib/agents/order-lookup"

const RETURN_WHAT_TO_DO = "היי הגיע לי השטיח ואני רוצה להחזיר מה עלי לעשות?"
const RETURN_OPTIONS = "היי הגיע לי השטיח ואני רוצה להחזיר מה אפשר לעשות?"
const DISSATISFACTION = "היי קיבלתי את השטיח ואני לא ממש אוהב אותו"
const DELAYED_SHIPMENT = "הזמנתי לפני שבוע ועוד לא קיבלתי את המשלוח"
const RETURN_PICKUP_WAIT =
  "היי אני מחכה שיאספו ממני שטיח שביצעתי החלפה כבר שבועיים שלוש\nאני אמורה ללדת בשבוע שבועיים הקרובים"
const RETURN_PICKUP_COMPLAINT =
  "אני לא מבין למה אני צריך לחכות כל כך הרבה זמן שיאספו את השטיח ממני, אני בסך הכל רוצה להחזיר אותו"

describe("owner routing decisions (v3 pattern layer)", () => {
  it("routes active return pickup wait to service, not return policy FAQ", () => {
    assert.equal(isReturnPolicyQuestion(RETURN_PICKUP_WAIT), false)
    assert.equal(isActiveReturnExchangePickupCase(RETURN_PICKUP_WAIT), true)
    assert.equal(classifyPostPurchaseCase(RETURN_PICKUP_WAIT), "return_pickup_pending")
    assert.equal(isFaqPolicyQuestion(RETURN_PICKUP_WAIT), false)
    assert.equal(isServiceTopicSwitch(RETURN_PICKUP_WAIT), true)
  })

  it("understands return pickup wait even when customer also says they want to return", () => {
    assert.equal(isReturnPolicyQuestion(RETURN_PICKUP_COMPLAINT), false)
    assert.equal(isActiveReturnExchangePickupCase(RETURN_PICKUP_COMPLAINT), true)
    assert.equal(classifyPostPurchaseCase(RETURN_PICKUP_COMPLAINT), "return_pickup_pending")
  })

  it("after intent confirm, service lookup context binds נכון", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nאוקיי, אני מבין שהוקמה בקשת איסוף לצורך החזרת מוצר וטרם הגיעו לאסוף אותו ממך, אני צודק?",
      },
    ]
    assert.equal(isOrderConfirmationYes("נכון"), true)
    assert.equal(isServiceLookupContext(history, "service"), true)
  })

  it("treats received + return + what-to-do as FAQ return policy, not service lookup", () => {
    for (const message of [RETURN_WHAT_TO_DO, RETURN_OPTIONS]) {
      assert.equal(isReturnPolicyQuestion(message), true, message)
      assert.equal(classifyPostPurchaseCase(message), null, message)
    }
  })

  it("treats hypothetical return eligibility after delivery as FAQ, not order lookup", () => {
    const delivery =
      "היי מה קורה השטיח הגיע היום ואני לא בבית עד מוצאי שבת"
    const eligibility =
      "במידה וזה לא ימצא חן בעיני נוכל להחזיר בראשון ולקבל את הזיכוי?"
    const history: HistoryMessage[] = [
      { role: "user", content: delivery },
    ]

    assert.equal(isReturnPolicyQuestion(eligibility), true)
    assert.equal(isReturnEligibilityQuestion(eligibility, history), true)
    assert.equal(classifyPostPurchaseCase(eligibility), null)
    assert.equal(isReturnEligibilityQuestion(`${delivery}\n${eligibility}`), true)
  })

  it("routes delayed shipment to shipping status, not service", () => {
    assert.equal(isShippingStatusQuestion(DELAYED_SHIPMENT), true)
    assert.equal(isServiceTopicSwitch(DELAYED_SHIPMENT), false)
  })

  it("uses deterministic dissatisfaction rescue with exchange-first policy", () => {
    assert.equal(isPostPurchaseDissatisfaction(DISSATISFACTION), true)
    const reply = buildDissatisfactionRescueReply()
    assert.match(reply, /\*החלפה\*/)
    assert.match(reply, /נציג מכירות/)
    assert.match(reply, /סניף הקרוב/)
    assert.match(reply, /returns\.carpetshop\.co\.il/)
    assert.doesNotMatch(reply, /מצב לא נעים/)
    assert.doesNotMatch(reply, /^מבין! אפשר להחליף/m)
  })
})
