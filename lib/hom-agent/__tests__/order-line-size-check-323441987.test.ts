import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const OFFER_CHECK =
  "*הום בוט :)*\nכדי לוודא שהמידה בהזמנה היא L, אוכל לבדוק את פרטי ההזמנה עצמה. לבדוק לך?"

const BAD_NO_LOOKUP =
  "אין לי אפשרות לשלוף מכאן את פירוט המוצרים בהזמנה"

/** 323441987 — post-purchase size L verify: כן תודה after לבדוק לך? must lookup, not skip to handoff. */
describe("order line size check 323441987", () => {
  const history: HistoryMessage[] = [
    {
      role: "user",
      content:
        "היי..הזמנתי היום שטיח ושולם בביט...איך אני בודקת שאכן מאושר ההזמנה..ולוודא שהגודל הרצוי הוא L?",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי אתי, תתחדשי! ... https://tracking.carpetshop.co.il/track?orderID=SO26025640 ... לבדוק לך?",
    },
    { role: "assistant", content: OFFER_CHECK },
  ]

  it("teaches lookup on affirm after size-check offer", () => {
    assert.match(prompt, /323441987/)
    assert.match(prompt, /lookup_order_status/)
    const hints = buildConversationHints({ body: "כן..תודה", history }) ?? ""
    assert.match(hints, /ORDER LINE SIZE CHECK YES \(323441987\)/)
    assert.match(hints, /SO26025640/)
    assert.match(hints, /lookup_order_status/i)
    assert.doesNotMatch(hints, new RegExp(BAD_NO_LOOKUP))
  })
})
