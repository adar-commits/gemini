import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  isKnownOrderConfirmPending,
  isOrderConfirmationPending,
  isServiceOrderIdentificationFlow,
  isShippingThreadFromHistory,
  orderIdGivenInThread,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const OPENER =
  "היי, מה נשמע? הזמנתי מכם לפני כחודשיים פופים והתאהבתי בהם, אז בשבוע שעבר הזמנתי עוד שניים. בזמן ההזמנה היה כתוב שהמשלוח יגיע תוך 4 ימי עסקים, כלומר עד מחר (7.10). בהזמנה הקודמת קיבלתי כמה ימים מראש הודעה עם יום ההגעה, והפעם עדיין לא קיבלתי הודעה, אז רציתי רק לבדוק איתכם אם המשלוח צפוי להגיע מחר. תודה רבה!"
const BOT_CONFIRM =
  "*הום בוט :)*\nהיי רומי! איזה כיף לשמוע שהפופים מהפעם הקודמת כל כך הצליחו. כדי לבדוק את המשלוח הנכון: מדובר בהזמנה SO26024641, זו שקישור המעקב שלה נשלח אחרונה בשיחה?"
const BODY = "אני לא יודעת, איפה אני יכולה לראות את מספר ההזמנה?"
const BAD_REPLY =
  "*הום בוט :)*\nכדי שהנציג לא יצטרך לשאול שוב, זה מה שאעביר לו:\n• מס׳ הזמנה: ⁦#78160⁩\n• אי-שביעות רצון מהמוצר\n• משך ההמתנה: שבוע\n\nזה מדויק, או שחסר משהו?"

/** Replay 528863688 — ETA thread: where to find order number must not open service rep summary. */
describe("ETA order number location FAQ 528863688", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: OPENER },
    { role: "assistant", content: BOT_CONFIRM },
  ]

  it("detects shipping thread and known order confirm pending", () => {
    assert.equal(isShippingThreadFromHistory(history), true)
    assert.equal(isOrderConfirmationPending(history), true)
    assert.equal(isKnownOrderConfirmPending(history), true)
    assert.equal(orderIdGivenInThread(history), "SO26024641")
  })

  it("does not treat order-number FAQ on shipping ETA thread as service identification", () => {
    assert.equal(isServiceOrderIdentificationFlow(history, BODY), false)
  })

  it("prompt teaches order-number FAQ on ETA thread — not service summary", () => {
    const line = prompt
      .split("\n")
      .find((l) => l.includes("528863688") && l.includes("order-number FAQ"))
    assert.ok(line, "missing ETA opener + order-number FAQ rule")
    assert.match(line!, /Never.*service rep summary/i)
    assert.match(line!, /lookup_order_status/)
  })

  it("hints FAQ answer + re-confirm — never service summary", () => {
    const hints = buildConversationHints({ body: BODY, history }) ?? ""
    assert.match(hints, /528863688/)
    assert.match(hints, /SO26024641/)
    assert.match(hints, /never service rep summary/i)
    assert.doesNotMatch(hints, /SERVICE ORDER ID/)
  })

  it("bad reply opened service handoff summary with wrong issue", () => {
    assert.match(BAD_REPLY, /אי-שביעות רצון/)
    assert.match(BAD_REPLY, /78160/)
    assert.doesNotMatch(BAD_REPLY, /(?:אימייל|SMS|אישור הזמנה)/)
  })
})
