import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  classifyPostPurchaseCase,
  isActiveReturnExchangePickupCase,
  isPostPurchaseDissatisfaction,
  isReturnPolicyQuestion,
} from "@/lib/agents/inquiry-intent"
import { buildDissatisfactionRescueReply } from "@/lib/agents/dissatisfaction"
import { guessMasterRoute } from "@/lib/agents/route-intent"
import { isShippingStatusQuestion } from "@/lib/agents/shipping"
import { isFaqPolicyQuestion } from "@/lib/agents/policy-subjects"
import { isServiceTopicSwitch } from "@/lib/agents/topic-switch"
import {
  buildReturnRequestConfirmedReply,
  resolvePostPurchaseCaseReply,
} from "@/lib/agents/post-purchase-case"
import { RETURN_PICKUP_PENDING_FLOW_MARKER } from "@/lib/agents/post-purchase-case.constants"
import { MISSING_ITEM_FLOW_MARKER } from "@/lib/agents/post-purchase-case.constants"
import type { OrderShipmentStatus } from "@/lib/agents/order-lookup"

const RETURN_WHAT_TO_DO = "היי הגיע לי השטיח ואני רוצה להחזיר מה עלי לעשות?"
const RETURN_OPTIONS = "היי הגיע לי השטיח ואני רוצה להחזיר מה אפשר לעשות?"
const DISSATISFACTION = "היי קיבלתי את השטיח ואני לא ממש אוהב אותו"
const DELAYED_SHIPMENT = "הזמנתי לפני שבוע ועוד לא קיבלתי את המשלוח"
const RETURN_PICKUP_WAIT =
  "היי אני מחכה שיאספו ממני שטיח שביצעתי החלפה כבר שבועיים שלוש\nאני אמורה ללדת בשבוע שבועיים הקרובים"
const RETURN_PICKUP_COMPLAINT =
  "אני לא מבין למה אני צריך לחכות כל כך הרבה זמן שיאספו את השטיח ממני, אני בסך הכל רוצה להחזיר אותו"

describe("owner routing decisions from trainer chat", () => {
  it("routes active return pickup wait to service, not return policy FAQ", async () => {
    assert.equal(isReturnPolicyQuestion(RETURN_PICKUP_WAIT), false)
    assert.equal(isActiveReturnExchangePickupCase(RETURN_PICKUP_WAIT), true)
    assert.equal(classifyPostPurchaseCase(RETURN_PICKUP_WAIT), "return_pickup_pending")
    assert.equal(isFaqPolicyQuestion(RETURN_PICKUP_WAIT), false)
    assert.equal(isServiceTopicSwitch(RETURN_PICKUP_WAIT), true)
    assert.equal(guessMasterRoute(RETURN_PICKUP_WAIT), "ROUTE_TO_SERVICE_AGENT")

    const reply = await resolvePostPurchaseCaseReply({
      body: RETURN_PICKUP_WAIT,
      phone: "+972547495083",
      history: [],
    })
    assert.match(reply, new RegExp(RETURN_PICKUP_PENDING_FLOW_MARKER))
    assert.match(reply, /אני צודק/)
    assert.match(reply, /בקשת איסוף/)
    assert.doesNotMatch(reply, /returns\.carpetshop\.co\.il/)
    assert.doesNotMatch(reply, /14 ימים/)
  })

  it("understands return pickup wait even when customer also says they want to return", async () => {
    assert.equal(isReturnPolicyQuestion(RETURN_PICKUP_COMPLAINT), false)
    assert.equal(isActiveReturnExchangePickupCase(RETURN_PICKUP_COMPLAINT), true)
    assert.equal(classifyPostPurchaseCase(RETURN_PICKUP_COMPLAINT), "return_pickup_pending")
    assert.equal(guessMasterRoute(RETURN_PICKUP_COMPLAINT), "ROUTE_TO_SERVICE_AGENT")

    const reply = await resolvePostPurchaseCaseReply({
      body: RETURN_PICKUP_COMPLAINT,
      phone: "+972547495083",
      history: [],
    })
    assert.match(reply, /בקשת איסוף/)
    assert.match(reply, /טרם הגיעו לאסוף/)
    assert.match(reply, /אני צודק/)
    assert.doesNotMatch(reply, /returns\.carpetshop\.co\.il/)
  })

  it("after intent confirm, proceeds to order lookup for return pickup wait", async () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: `*הום בוט :)*\n${RETURN_PICKUP_PENDING_FLOW_MARKER}.\nאוקיי, אני מבין שהוקמה בקשת איסוף לצורך החזרת מוצר וטרם הגיעו לאסוף אותו ממך, אני צודק?`,
        agent: "service",
      },
    ]
    const reply = await resolvePostPurchaseCaseReply({
      body: "כן",
      phone: "+972547495083",
      history,
    })
    assert.match(reply, /נאתר את ההזמנה/)
    assert.match(reply, /0547-495083/)
  })

  it("treats received + return + what-to-do as FAQ return policy, not service lookup", () => {
    for (const message of [RETURN_WHAT_TO_DO, RETURN_OPTIONS]) {
      assert.equal(isReturnPolicyQuestion(message), true, message)
      assert.equal(classifyPostPurchaseCase(message), null, message)
    }
  })

  it("routes delayed shipment to shipping status, not service", () => {
    assert.equal(isShippingStatusQuestion(DELAYED_SHIPMENT), true)
    assert.equal(guessMasterRoute(DELAYED_SHIPMENT), "ROUTE_TO_SHIPPING_STATUS")
  })

  it("uses deterministic dissatisfaction rescue with portal policy", () => {
    assert.equal(isPostPurchaseDissatisfaction(DISSATISFACTION), true)
    const reply = buildDissatisfactionRescueReply()
    assert.match(reply, /returns\.carpetshop\.co\.il/)
    assert.match(reply, /יועץ מכירות/)
    assert.doesNotMatch(reply, /^מבין! אפשר להחליף/m)
  })

  it("after return order confirmed, sends portal policy before optional נציג", () => {
    const order: OrderShipmentStatus = {
      orderNumber: "SO26020888",
      statusCode: "delivered",
      statusLabel: "נמסר",
      branchLabel: "אתר אינטרנט",
      branchCode: "3000",
      totalPrice: 35.55,
      statusDescription: "המשלוח נמסר",
    }
    const reply = buildReturnRequestConfirmedReply(order)
    assert.match(reply, /SO26020888/)
    assert.match(reply, /returns\.carpetshop\.co\.il/)
    assert.match(reply, /נציג/)
    assert.doesNotMatch(reply, /האם להעביר את הפנייה לנציג שירות שיטפל/)
  })

  it("clarifies bare numeric mid-flow instead of assuming order number", async () => {
    const history: HistoryMessage[] = [
      {
        role: "user",
        content: "ביצעתי שתי הזמנות וקיבלתי רק אחת מהן",
        agent: null,
      },
      {
        role: "assistant",
        content: `*הום בוט :)*\n${MISSING_ITEM_FLOW_MARKER}.\nאיזה מוצר היה בהזמנה שלא הגיעה?`,
        agent: "service",
      },
      { role: "user", content: "שטיח בהיר לסלון", agent: null },
    ]
    const reply = await resolvePostPurchaseCaseReply({
      body: "664483",
      phone: "+972547495083",
      history,
    })
    assert.match(reply, /664483/)
    assert.match(reply, /מספר ההזמנה/)
  })
})
