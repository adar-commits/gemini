import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isShippingAddressChangeAsk } from "@/lib/agents/post-purchase-alt-size"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const BAD_HANDOFF =
  "*הום בוט :)* מצטער על ההמתנה, נועה. העברתי עכשיו את הבקשה שלך ליועץ מכירות: עדכון כשלני בז' (LENNY) במידה L 160*230 יחזור למלאי."

const CHASE =
  "מחכה כבר שתענו תודה\n[תמונה][media:image:https://storage.googleapis.com/media.landbot.io/example.jpg]"

/** Replay 503283358 — address change + ETA chase must not hand off as LENNY back-in-stock sales. */
describe("shipping address eta wait chase 503283358", () => {
  const history: HistoryMessage[] = [
    {
      role: "user",
      content: "אבקש לשנות את הכתובת למשלוח של הזמנה L1UWIC01T",
    },
    {
      role: "user",
      content: "שלחתי גם מייל עוד ביום ההזמנה ולא קיבלתי מענה עדיין",
    },
    { role: "user", content: "הכתובת היא העוגן 24 גן יבנה" },
    {
      role: "assistant",
      content:
        "היי נעה זמיר, כאן אביגיל, פונה אליך בעקבות שינוי כתובת. שלח/י לי הודעה חוזרת ונוכל להמשיך את הטיפול מכאן.",
    },
    { role: "user", content: "היי" },
    { role: "user", content: "אשמח לשנות את הכתובת לעוגן 24, גן יבנה" },
    {
      role: "user",
      content: "ואשמח לדעת מתי עתיד להגיע כדי שאוכל להיות בקבלה",
    },
    { role: "user", content: "די נו עד שאתם פונים אין עם מי לדבר" },
    { role: "user", content: "????????" },
  ]

  it("recognizes address change in thread on chase turn", () => {
    assert.equal(isShippingAddressChangeAsk(CHASE, history), true)
    assert.match(history[0]!.content, /L1UWIC01T/)
  })

  it("hints service handoff with address+ETA recap — not sales stock", () => {
    const hints = buildConversationHints({
      history,
      body: CHASE,
      whatsappPhone: "+972547497765",
    })
    assert.match(hints, /503283358/)
    assert.match(hints, /SHIPPING ADDRESS \+ ETA WAIT CHASE/)
    assert.match(hints, /human_service/i)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /SHIPPING ADDRESS PHOTO CHASE/)
    assert.doesNotMatch(hints, /PHOTO RECEIVED \(533695023/)
    assert.doesNotMatch(hints, /ORDER MODIFICATION \(441694412/)
  })

  it("bad handoff reply is the wrong pivot", () => {
    assert.match(BAD_HANDOFF, /LENNY/)
    assert.match(BAD_HANDOFF, /human_sales|יועץ מכירות/)
    assert.doesNotMatch(BAD_HANDOFF, /L1UWIC01T/)
    assert.doesNotMatch(BAD_HANDOFF, /עוגן/)
  })
})
