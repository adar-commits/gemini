import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  hasRecentShippingAddressChangeRequest,
  isShippingAddressChangeWithDeliveryEtaThread,
} from "@/lib/agents/post-purchase-alt-size"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const OLD_STOCK = {
  role: "user" as const,
  content:
    "היי, אשמח לקבל עדכון כשהמידה L - 160*230 של שטיח לני בז' LENNY חוזרת למלאi",
}

const BAD_BOT_REPLY =
  "*הום בוט :)*\nמצטער על ההמתנה, נועה.\n\nהעברתי עכשיו את הבקשה שלך ליועץ מכירות: עדכון כשלני בז' (LENNY) במידה L ‏160*230 יחזור למלאi."

/** Replay 503283358 — address change thread must not re-handoff to sales for old LENNY stock alert. */
describe("shipping address not sales 503283358", () => {
  const history: HistoryMessage[] = [
    OLD_STOCK,
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nאני לא יכול לרשום מכאן התראה… מעביר את הבקשה ליועץ מכירות…",
    },
    {
      role: "user",
      content: "אבקש לשנות את הכתובת למשלוח של הזמנה L1UWIC01T",
    },
    { role: "user", content: "הכתובת היא העוגן 24 גן יבנה" },
    {
      role: "user",
      content: "אשמח לשנות את הכתובת לעוגן 24, גן יבנה",
    },
    {
      role: "user",
      content: "ואשמח לדעת מתי עתיד להגיע כדי שאוכל להיות בקבלה",
    },
    { role: "user", content: "מחכה כבר שתענו תודה" },
  ]

  it("detects recent address-change thread state", () => {
    assert.equal(hasRecentShippingAddressChangeRequest(history, "מחכה כבר שתענו תודה"), true)
    assert.equal(isShippingAddressChangeWithDeliveryEtaThread(history, "מחכה כבר שתענו תודה"), true)
  })

  it("hints service handoff — never human_sales or old stock recap", () => {
    const hints = buildConversationHints({
      body: "מחכה כבר שתענו תודה",
      history,
    })
    assert.match(hints ?? "", /503283358/)
    assert.match(hints ?? "", /human_service/)
    assert.match(hints ?? "", /Never.*human_sales/i)
    assert.match(hints ?? "", /LENNY|חוזר למלאi/)
  })

  it("documents the production misroute pattern", () => {
    assert.match(BAD_BOT_REPLY, /יועץ מכירות/)
    assert.match(BAD_BOT_REPLY, /LENNY/)
  })
})
