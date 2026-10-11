import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { extractOrderReference } from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const BAD_HANDOFF =
  "*הום בוט :)* מצטער שעדיין לא קיבלת תשובה, עומרי. כרגע אין לי כאן את סטטוס המשלוח של הזמנה #77448, לכן אני מעביר עכשיו את הפנייה לנציג שירות."

/** Replay 534276359 — כן לבדוק after recheck offer must lookup, not duplicate human_service. */
describe("status recheck offer after handoff 534276359", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "רציתי לדעת מתי תסופק ההזמנה" },
    {
      role: "assistant",
      content: "מצאתי הזמנה … זו ההזמנה? (מס׳ הזמנה ⁦#77448⁩)",
    },
    { role: "user", content: "כן" },
    {
      role: "assistant",
      content:
        "לא מצליח להציג כאן את סטטוס המשלוח … להעביר אותך לנציג שירות שיבדוק מתי בדיוק ההזמנה תסופק?",
    },
    { role: "user", content: "כן" },
    {
      role: "assistant",
      content: "מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם.",
    },
    { role: "user", content: "היי מחכה ליצירת קשר" },
    { role: "user", content: "היי" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי עומרי, בוקר טוב! במה אפשר לעזור? אם זה לגבי הזמנה #77448, אשמח לבדוק שוב את הסטטוס שלה.",
    },
  ]
  const body = "כן לבדוק"

  it("keeps known order in thread", () => {
    assert.equal(extractOrderReference(history.at(-1)!.content, history), "77448")
  })

  it("hints lookup on recheck affirm — not duplicate handoff", () => {
    const hints = buildConversationHints({ body, history }) ?? ""
    assert.match(hints, /STATUS RECHECK OFFER YES \(534276359\)/)
    assert.match(hints, /77448/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /does NOT justify another handoff/)
  })

  it("prompt teaches post-handoff status recheck binding", () => {
    const line = prompt.split("\n").find((l) => l.includes("534276359"))
    assert.ok(line, "missing 534276359 status recheck rule")
    assert.match(line!, /lookup_order_status/)
    assert.match(line!, /לבדוק שוב/)
  })

  it("bad reply re-handoffs without lookup", () => {
    assert.match(BAD_HANDOFF, /מעביר/)
    assert.match(BAD_HANDOFF, /#77448/)
  })
})
