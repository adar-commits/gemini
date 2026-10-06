import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { classifyPostPurchaseCase } from "@/lib/agents/inquiry-intent"
import {
  isKnownOrderConfirmPending,
  isOrderDeliveryStatusQuestion,
  isServiceOrderIdentificationFlow,
  isShippingThreadFromHistory,
  orderIdGivenInThread,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const OPENER =
  "היי, מה נשמע? 😊 הזמנתי מכם לפני כחודשיים פופים והתאהבתי בהם, אז בשבוע שעבר הזמנתי עוד שניים 😍 בזמן ההזמנה היה כתוב שהמשלוח יגיע תוך 4 ימי עסקים, כלומר עד מחר (7.10). בהזמנה הקודמת קיבלתי כמה ימים מראש הודעה עם יום ההגעה, והפעם עדיין לא קיבלתי הודעה, אז רציתי רק לבדוק איתכם אם המשלוח צפוי להגיע מחר 🙏🏻 תודה רבה! מחכה כבר לפופים החדשים 🥰"
const BOT_CONFIRM =
  "*הום בוט :)* היי רומי! איזה כיף לשמוע שהפופים מהפעם הקודמת כל כך הצליחו. כדי לבדוק את המשלוח הנכון: מדובר בהזמנה SO26024641, זו שקישור המעקב שלה נשלח אחרונה בשיחה?"
const LOCATION_ASK = "אני לא יודעת, איפה אני יכולה לראות את מספר ההזמנה?"
const BAD_REPLY =
  "*הום בוט :)*\nכדי שהנציג לא יצטרך לשאול שוב, זה מה שאעביר לו:\n• מס׳ הזמנה: ⁦#78160⁩\n• אי-שביעות רצון מהמוצר\n• משך ההמתנה: שבוע\n\nזה מדויק, או שחסר משהו?"

/** Replay 528863688 — ETA thread + where to find order # must not open service rep summary. */
describe("ETA order number location 528863688", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: OPENER },
    { role: "assistant", content: BOT_CONFIRM },
  ]

  it("detects shipping thread and known order confirm pending", () => {
    assert.equal(isOrderDeliveryStatusQuestion(OPENER), true)
    assert.equal(isShippingThreadFromHistory(history), true)
    assert.equal(isKnownOrderConfirmPending(history), true)
    assert.equal(orderIdGivenInThread(history), "SO26024641")
  })

  it("location ask is not classified as service post-purchase case", () => {
    assert.equal(classifyPostPurchaseCase(LOCATION_ASK), null)
  })

  it("does not treat location ask on shipping ETA thread as service identification", () => {
    assert.equal(isServiceOrderIdentificationFlow(history, LOCATION_ASK), false)
  })

  it("prompt teaches location ask on ETA thread — lookup not service summary", () => {
    const line = prompt
      .split("\n")
      .find((l) => l.includes("528863688") && l.includes("order number location"))
    assert.ok(line, "missing ETA + order number location rule")
    assert.match(line!, /lookup_order_status/)
    assert.match(line!, /Never.*service rep summary/i)
  })

  it("hints explain location + continue ETA — never service summary", () => {
    const hints = buildConversationHints({ body: LOCATION_ASK, history }) ?? ""
    assert.match(hints, /KNOWN ORDER CONFIRM \+ ETA \(533011641 /)
    assert.match(hints, /528863688/)
    assert.match(hints, /where to find the order number/)
    assert.match(hints, /lookup_order_status/)
    assert.doesNotMatch(hints, /SERVICE ORDER ID:/)
  })

  it("bad reply opened service handoff summary instead of shipping help", () => {
    assert.match(BAD_REPLY, /(?:מעביר|אעביר)/)
    assert.match(BAD_REPLY, /אי-שביעות רצון/)
    assert.doesNotMatch(BAD_REPLY, /(?:מייל|SMS|חשבונית|מעקב)/)
  })
})
