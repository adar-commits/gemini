import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  classifyPostPurchaseCase,
  isPostPurchaseDissatisfaction,
  isReturnPolicyQuestion,
} from "@/lib/agents/inquiry-intent"
import { buildDissatisfactionRescueReply } from "@/lib/agents/dissatisfaction"
import { guessMasterRoute } from "@/lib/agents/route-intent"
import { isShippingStatusQuestion } from "@/lib/agents/shipping"
import {
  buildReturnRequestConfirmedReply,
  resolvePostPurchaseCaseReply,
} from "@/lib/agents/post-purchase-case"
import { MISSING_ITEM_FLOW_MARKER } from "@/lib/agents/post-purchase-case.constants"
import type { OrderShipmentStatus } from "@/lib/agents/order-lookup"

const RETURN_WHAT_TO_DO = "היי הגיע לי השטיח ואני רוצה להחזיר מה עלי לעשות?"
const RETURN_OPTIONS = "היי הגיע לי השטיח ואני רוצה להחזיר מה אפשר לעשות?"
const DISSATISFACTION = "היי קיבלתי את השטיח ואני לא ממש אוהב אותו"
const DELAYED_SHIPMENT = "הזמנתי לפני שבוע ועוד לא קיבלתי את המשלוח"

describe("owner routing decisions from trainer chat", () => {
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
