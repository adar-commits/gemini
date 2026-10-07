import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { hasDeclarativeHandoffTransfer } from "@/lib/agents/off-topic"
import type { HistoryMessage } from "@/lib/agents/types"

const OPENING =
  "החזרתי שטיח שקניתי אצלכם וביקשתי שישאירו את הסכום אצלכם לזיכוי כדי שאוכל לרכוש בעתיד שטיח אחר.\nבחנות עשו את זה אבל אמרו לי שצריך אחרי חודש לפנות לשירות לקוחות כדי להאריך את הזמן שהכסף יישאר לזיכוי"

const BAD_REPLY =
  "*הום בוט :)*\nהיי רננה,\n\nהבנתי. החזרת את השטיח, הסכום נשמר אצלנו כזיכוי לרכישה הבאה, ועכשיו צריך להאריך את תוקף הזיכוי.\n\nאת ההארכה מאשר נציג שירות, אז אני מעביר אלייך נציג עכשיו. אלה הפרטים שהוא יקבל:\n• החזרת שטיח בסניף, והסכום נשמר כזיכוי\n• בקשה להאריך את תוקף הזיכוי\n• טלפון: 050-6551831"

/** Replay 325658694 — store credit validity extension must bind מעביר to human_service. */
describe("store credit validity extension handoff (325658694)", () => {
  it("emits the credit validity extension hint on opening turn", () => {
    const history: HistoryMessage[] = []
    const hints = buildConversationHints({ history, body: OPENING }) ?? ""
    assert.match(hints, /325658694/)
    assert.match(hints, /human_service/)
    assert.match(hints, /Never action reply/)
  })

  it("flags the bad reply as declarative transfer prose without human_service", () => {
    assert.equal(hasDeclarativeHandoffTransfer(BAD_REPLY), true)
    assert.match(BAD_REPLY, /אני מעביר/)
    assert.match(BAD_REPLY, /נציג שירות/)
  })
})
