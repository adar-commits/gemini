import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { isPastOrderSizeRecallQuestion, hasOngoingSalesIntake } from "@/lib/agents/sales-intake"
import {
  isPriorOrderSizeReorderThread,
  isSalesTransferPromisedInLastAssistant,
} from "@/lib/agents/product-handoff"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { VOICE_CLOSURE_TEMPLATE_BODY } from "@/lib/landbot/voice-closure-template"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const SIZE_ASK = "אני רוצה לדעת איזה מידה הזמנתי מכם בעבר"
const COMBINED =
  "אני רוצה לדעת איזה מידה הזמנתי מכם בעבר\nאתה נציג אנושי?"
const WRONG_REPLY =
  "*הום בוט :)* לא, אני הבוט של הצוות ההודעה הקודמת הייתה הודעה אוטומטית, ועדיין לא כתב לך נציג. אין לי כאן גישה לפרטי ההזמנה הקודמת שלך, אז אני מעביר אותך עכשיו ליועץ מכירות. הוא יבדוק באיזו מידה הזמנת את השטיח בעבר ויעזור לך להזמין את הוריזון אפור באותה מידה."

function history534159887(): HistoryMessage[] {
  return [
    { role: "user", content: SIZE_ASK },
    { role: "assistant", content: VOICE_CLOSURE_TEMPLATE_BODY },
  ]
}

/** 534159887 — past order size ask must lookup, not claim no access or invent product names. */
describe("past order size recall 534159887", () => {
  it("detects past order size recall from customer wording", () => {
    assert.equal(isPastOrderSizeRecallQuestion(SIZE_ASK), true)
    assert.equal(isPastOrderSizeRecallQuestion(COMBINED), true)
    assert.equal(isPastOrderSizeRecallQuestion("אני רוצה לשנות מידה בהזמנה"), false)
  })

  it("prompt teaches lookup before handoff and no invented product names", () => {
    const line = prompt.split("\n").find((l) => l.includes("534159887"))
    assert.ok(line, "missing past order size recall rule")
    assert.match(line!, /lookup_order_status/)
    assert.match(line!, /Never.*name a product|Never.*invent/i)
  })

  it("hints lookup_order_status — never no-access handoff or invented model", () => {
    const hints =
      buildConversationHints({
        history: history534159887(),
        body: COMBINED,
        whatsappPhone: "+972521045643",
      }) ?? ""
    assert.match(hints, /534159887/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /Never claim you have no access/)
    assert.match(hints, /Never invent a product/)
  })

  it("wrong production reply skipped lookup and invented horizon gray", () => {
    assert.match(WRONG_REPLY, /אין לי כאן גישה/)
    assert.match(WRONG_REPLY, /הוריזון אפור/)
    assert.doesNotMatch(WRONG_REPLY, /lookup_order_status/)
  })

  it("blocks sales transfer loop after bot promised size check", () => {
    const BOT_TRANSFER =
      "*הום בוט :)* בכיף אביבה. אני מעביר אותך עכשיו ליועץ מכירות. הוא יבדוק באיזו מידה הזמנת בפעם הקודמת."
    const history: HistoryMessage[] = [
      {
        role: "user",
        content:
          "היי אשמח לפרטים נוספים לגבי שטיח הוריזון אפור HORIZON\nבעבר הזמנתי מכם שטיח",
      },
      {
        role: "assistant",
        content:
          "*הום בוט :)* היי אביבה! לאיזה חלל את מחפשת את השטיח? סלון, חדר שינה או משהו אחר?",
      },
      {
        role: "user",
        content:
          "אני רוצה לברר איזו מידה זו הייתה, אני רוצה להזמין מכם את אותה המידה\nנציג אנושי",
      },
      { role: "assistant", content: BOT_TRANSFER },
      { role: "user", content: "אני רוצה לברר מידה של ההזמנה האחרונה שלי" },
    ]
    const body = "אני רוצה לברר מידה של ההזמנה האחרונה שלי"

    assert.equal(isPriorOrderSizeReorderThread(history), true)
    assert.equal(hasOngoingSalesIntake(history), true)
    assert.equal(isSalesTransferPromisedInLastAssistant(history), true)

    const hints = buildConversationHints({ body, history }) ?? ""
    assert.match(hints, /534159887/)
    assert.match(hints, /lookup_order_status/)
    assert.doesNotMatch(hints, /SALES TRANSFER PROMISED \(533891498\)/)
  })
})
