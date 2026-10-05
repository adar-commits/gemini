import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { hasOngoingSalesIntake, isAwaitingSalesIntakeAnswer } from "@/lib/agents/sales-intake"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

/** 534144877 — GARDA sales intake: mid-quiz "ציינתi לiועץ" while still asking kids question. */
describe("sales intake advisor wording 534144877", () => {
  const history: HistoryMessage[] = [
    {
      role: "user",
      content: "היי אשמח לפרטים נוספים לגבי שטיח גארדה 03 קרם GARDA",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי גוני! בשמחה, אני אעזור עם גארדה 03 בגוון קרם. כדי שיועץ המכירות יוכל לתת את כל הפרטים ולהתאים את השטיח, אשאל קודם: לאיזה חלל השטיח מיועד? סלון, חדר שינה או חדר אחר?",
    },
  ]

  const body =
    "סלון גדול לילדים שסגרנו בחוץ בסגירת חורף עם אלומיניום וזכוכיות \nהריצפה שיש מתחת זה דק"

  const badReply =
    "תודה, מצוין. ציינתי ליועץ שהשטיח מיועד לחלל סגור עם אלומיניום וזכוכית ושהרצפה היא דק. הילדים שמשתמשים בחלל קטנים, גדולים, או גם וגם?"

  it("prompt forbids mid-quiz ציינתi לiועץ before handoff", () => {
    assert.match(prompt, /534144877/)
    assert.match(prompt, /ציינתי ליועץ/)
    assert.match(prompt, /action: human_sales/)
  })

  it("detects ongoing sales intake after room answer", () => {
    assert.equal(hasOngoingSalesIntake(history), true)
    assert.equal(isAwaitingSalesIntakeAnswer(history), true)
  })

  it("hints bind mid-quiz intake to no advisor-transfer wording", () => {
    const hints = buildConversationHints({
      history,
      body,
      whatsappPhone: "+972500000000",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /SALES INTAKE QUIZ/)
    assert.match(hints!, /534144877/)
    assert.match(hints!, /ציינתי/)
    assert.match(hints!, /summary\+human_sales/)
  })

  it("wrong reply pattern must not appear in ideal mid-quiz ack", () => {
    assert.match(badReply, /ציינתי ליועץ/)
    assert.doesNotMatch(
      "תודה, רשמתי — חלל סגור עם אלומיניום וזכוכית, רצפה דק. הילדים שמשתמשים בחלל קטנים, גדולים, או גם וגם?",
      /ציינתי ליועץ|העברתי ליועץ|אעביר ליועץ/
    )
  })
})
