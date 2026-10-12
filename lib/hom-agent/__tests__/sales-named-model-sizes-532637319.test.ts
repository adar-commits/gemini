import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isSalesNamedModelSizeListQuestion } from "@/lib/agents/inventory-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const BAD_REPLY =
  "*הום בוט :)*\nהיי קרן!\n\nכאן אין לי את רשימת כל המידות של פירנצה, אז אני מעביר אותך עכשיו ליועץ מכירות."

function historyThroughFirenzeRep(): HistoryMessage[] {
  return [
    {
      role: "user",
      content:
        "היי אני מחפשת שטיח שאגי קטיפתי מלבני בצבע שמנת או ב'ז במידה 1.60 על 2.90 מה יש במלאי תודה",
    },
    {
      role: "assistant",
      content: "*הום בוט :)* בדקתי זמינות לדגם 31503138-200290: הדגם זמין כרגע להזמנה מוקדמת.",
    },
    {
      role: "user",
      content: "היי אשמח לפרטים נוספים לגבי שטיח פירנצה 01 קרם FIRENZE",
    },
    { role: "assistant", content: "בוקר טוב. מידה 160*230 או 200*290?" },
    {
      role: "assistant",
      content:
        "את דגם פירנצה ניתן לחתוך בתשלום. את רוכשת בעצם את הדגם במידה 200*290 + תשלום חיתוך 460 ש\"ח",
    },
  ]
}

const BODY = "היי באיזה מידות יש את השטיח פירנצה"

/** Replay 532637319 — Firenze size list must not jump to human_sales without lookup path. */
describe("sales named model sizes 532637319", () => {
  it("detects named-model size question with prior rep sizing talk", () => {
    const history = historyThroughFirenzeRep()
    assert.equal(isSalesNamedModelSizeListQuestion(BODY, history), true)
  })

  it("bad production reply handoff without size list attempt", () => {
    assert.match(BAD_REPLY, /אין לי את רשימת כל המידות/)
    assert.match(BAD_REPLY, /מעביר/)
  })

  it("emits SALES NAMED MODEL SIZES hint with lookup_inventory path", () => {
    const hints =
      buildConversationHints({
        history: historyThroughFirenzeRep(),
        body: BODY,
      }) ?? ""
    assert.match(hints, /SALES NAMED MODEL SIZES \(532637319\)/)
    assert.match(hints, /lookup_inventory/)
    assert.match(hints, /Never.*human_sales/)
  })
})
