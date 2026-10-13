import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  isPaymentArrangementAsk,
  isSalesPaymentArrangementFollowUp,
} from "@/lib/agents/payment-intent"
import { hasLiveRepReplyAfterBotHandoff } from "@/lib/agents/post-handoff"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const SALES_HANDOFF =
  "*הום בוט :)*\nתודה, רשמתי אז לסיכום, בשביל יועץ המכירות:\n• שטיח שאל פרסי 00 צבעוני SHIRAZ במידה 391*300\n• לסלון, ואת צריכה שטיח 3*4\n• אין בבית בעלי חיים\n• חשוב לך שיהיה קל לניקוי ועמיד\n\nמעביר אותך עכשיו ליועץ מכירות שימשיך איתך.\n\nמעולה, העברתי את השיחה ליועץ מכירות. ניצור קשר בהקדם."

const BAD_REPLY =
  "*הום בוט :)*\nאוקיי, אז לסיכום אני מחפש עבורכם שטיח לסלון בגודל אני צריכה שטיח 3*4 ללא בעלי חיים, חשוב: כן ברור.\n\nמעביר עכשיו ליועץ מכירות שימשיך מכאן."

const PAYMENT_ASK = "היי אני רוצה להסדיר תשלום\n11000"

function history527257973(): HistoryMessage[] {
  return [
    { role: "user", content: "היי אשמח לפרטים נוספים לגבי שטיח שאל פרסi" },
    { role: "assistant", content: "*הום בוט :)* היי! לאיזה חלל?" },
    { role: "user", content: "לסלון" },
    { role: "user", content: "אני צריכה שטיח 3*4" },
    { role: "user", content: "לא" },
    { role: "user", content: "הכל חשוב" },
    { role: "assistant", content: SALES_HANDOFF },
    { role: "assistant", content: "היי כן, הגודל יתאים.. זה כמעט 300*400" },
    { role: "assistant", content: "16,400" },
  ]
}

/** Replay 527257973 — payment arrangement must not replay stale sales intake summary. */
describe("sales payment arrangement 527257973", () => {
  it("detects payment arrangement ask", () => {
    assert.equal(isPaymentArrangementAsk(PAYMENT_ASK), true)
  })

  it("detects follow-up after sales handoff and rep price", () => {
    const history = history527257973()
    assert.equal(hasLiveRepReplyAfterBotHandoff(history), true)
    assert.equal(isSalesPaymentArrangementFollowUp(history, PAYMENT_ASK), true)
  })

  it("bad reply replays stale intake summary", () => {
    assert.match(BAD_REPLY, /מחפש עבורכם שטיח/)
  })

  it("hints forbid stale intake recap", () => {
    const hints =
      buildConversationHints({
        history: history527257973(),
        body: PAYMENT_ASK,
      }) ?? ""
    assert.match(hints, /SALES PAYMENT ARRANGEMENT \(527257973\)/)
    assert.match(hints, /never.*מחפש עבורכם שטיח/i)
    assert.match(hints, /human_sales/)
  })

  it("prompt teaches sales payment after quote", () => {
    const line = prompt
      .split("\n")
      .find((l) => l.includes("Sales payment after quote (527257973)"))
    assert.ok(line)
    assert.match(line!, /מחפש עבורכם שטיח/)
  })
})
