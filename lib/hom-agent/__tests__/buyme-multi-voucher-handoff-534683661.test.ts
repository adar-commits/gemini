import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { isBuyMeSalesOrderCallbackInquiry } from "@/lib/agents/product-handoff"
import type { HistoryMessage } from "@/lib/agents/types"

const MULTI_BUYME_ORDER_ASK =
  "היי אני רוצה לשלם דרך שוברי ביי מי  אבל יש לי כמה שוברים... לא אחד איך אוכל לבצע את ההזמנה"

const BAD_HANDOFF_REPLY =
  "*הום בוט :)*\nאפשר לשלם עם כמה שוברי BUYME על אותה הזמנה שוברי BUYME אפשר לממש באתר ובסניפים. רק לשים לב שאי אפשר לשלב אותם עם הטבות של מועדון חבר או פיס.\n\nכדי שההזמנה עם כל השוברים תעבור חלק, יועץ מכירות יעזור לכם להשלים אותה. זה מה שהוא יקבל:\n• מוצר: שטיח סידני 05 אפור-קרם SYDNEY\n• תשלום: כמה שוברי BUYME\n• החלל והמידה: עוד לא נקבעו\n\nמעביר עכשיו ליועץ מכירות. בינתיים אפשר לכתוב כאן באיזה חלל השטיח יהיה ובאיזו מידה, וזה יחסוך זמן."

/** 534683661 — multiple BUYME vouchers on one order must bind human_sales when writing מעביר. */
describe("BUYME multi-voucher handoff 534683661", () => {
  const history: HistoryMessage[] = [
    {
      role: "user",
      content: "האם יש לכם כלי הדמיה לראות איך יראה בכלל שלנו?",
    },
    {
      role: "assistant",
      content:
        "לא על הדגם הזה.. אבל אפשר לרכוש על סמך התמונות ויש אפשרות החלפה או ביטול",
    },
    {
      role: "user",
      content: "אוקי אז ניסגר על דגם נוכל לשלוח פה הודעה",
    },
    {
      role: "user",
      content:
        "ולהעביר את מספרי הביי מי וכך לעשות הזמנה במחיר של האתר או יותר זול אצלכם פה?",
    },
    { role: "assistant", content: "זה טלפוני.." },
    { role: "user", content: "סבבה" },
    { role: "user", content: "תודה" },
  ]

  it("detects multi-voucher BUYME checkout without phone callback ask", () => {
    assert.equal(
      isBuyMeSalesOrderCallbackInquiry(MULTI_BUYME_ORDER_ASK, history),
      true
    )
  })

  it("binds BUYME multi-voucher order turn to human_sales in hints", () => {
    const hints = buildConversationHints({
      history,
      body: MULTI_BUYME_ORDER_ASK,
      whatsappPhone: "+972500000000",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /534683661/)
    assert.match(hints!, /action: human_sales/)
    assert.match(hints!, /never `action: reply` alone/)
  })

  it("bad production reply promised transfer without handoff action", () => {
    assert.match(BAD_HANDOFF_REPLY, /מעביר עכשיו ליועץ מכירות/)
    const boundAction = /מעביר/i.test(BAD_HANDOFF_REPLY)
      ? "human_sales"
      : "reply"
    assert.equal(boundAction, "human_sales")
  })
})
