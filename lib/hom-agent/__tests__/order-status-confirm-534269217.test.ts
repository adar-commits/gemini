import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { orderIdGivenInThread } from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const OPENER =
  "שלום. מבקש לדעת מה קורה עים ההזמנה של השטיחים שביצענו . ההזמנה על שם רמי שיש גיבעתי 9 רשלצ. טל 0529468606"
const BOT_CONFIRM_1 =
  "*הום בוט :)*\nשלום רמי, לפי הקבלה שנשלחה אליך, מדובר בהזמנה SO26024984 — זו ההזמנה שעליה אתה שואל?"
const BOT_CONFIRM_2 =
  "*הום בוט :)*\nאין בעיה רמי, לא צריך את מספר ההזמנה. המספר SO26024984 מופיע בקבלה שנשלחה לטלפון 0529468606, ואני מניח שזו ההזמנה של 2 השטיחים העגולים. זו ההזמנה?"
const BODY = "כניראה\nהמס טל הזה הוא שלי"
const BAD_REPLY =
  "*הום בוט :)*\nתודה רמי, רשמתי שההזמנה על הטלפון שלך, 0529468606.\n\nכרגע אני לא יכול להציג כאן את סטטוס ההזמנה של 2 השטיחים העגולים, לכן אני מעביר אותך לנציג שירות שיבדוק ויעדכן אותך."
const REPEAT_BODY = "מה קורה עים המישלוח של השטיחים"
const REPEAT_BAD_REPLY =
  "*הום בוט :)*\nרמי, מצטער שעדיין אין לך תשובה.\n\nאני לא יכול להציג כאן את סטטוס המשלוח של 2 השטיחים העגולים (הזמנה SO26024984), לכן אני מעביר אותך עכשיו לנציג שירות."

/** Replay 534269217 — status opener + receipt confirm must lookup, not handoff. */
describe("order status confirm 534269217", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: OPENER },
    { role: "assistant", content: BOT_CONFIRM_1 },
    { role: "user", content: "הזמנת 2 שטיחים עגולים לא יודע מה מיס ההזמנה" },
    { role: "assistant", content: BOT_CONFIRM_2 },
  ]

  it("thread carries receipt order id from bot confirm ask", () => {
    assert.equal(orderIdGivenInThread(history), "SO26024984")
  })

  it("prompt teaches lookup after status opener confirm — no pre-lookup handoff", () => {
    const line = prompt.split("\n").find((l) => l.includes("534269217"))
    assert.ok(line, "missing status opener confirm rule for 534269217")
    assert.match(line!, /lookup_order_status/)
    assert.match(line!, /מה קורה/)
  })

  it("hints bind typo confirm + phone ownership to receipt order lookup", () => {
    const hints = buildConversationHints({ body: BODY, history }) ?? ""
    assert.match(hints, /RECEIPT ORDER CONFIRM BINDING \(534269217\)/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /Never claim you cannot see status/)
    assert.doesNotMatch(hints, /EXPLICIT REP REQUEST/)
  })

  it("bad reply handed off without lookup", () => {
    assert.match(BAD_REPLY, /לא יכול להציג/)
    assert.match(BAD_REPLY, /מעביר/)
  })

  const repeatHistory: HistoryMessage[] = [
    { role: "user", content: OPENER },
    { role: "assistant", content: BOT_CONFIRM_1 },
    { role: "user", content: "הזמנת 2 שטיחים עגולים לא יודע מה מיס ההזמנה" },
    { role: "assistant", content: BOT_CONFIRM_2 },
    { role: "user", content: BODY },
    { role: "assistant", content: BAD_REPLY },
    { role: "user", content: "אפשר לדבר עים נציג שרות" },
    {
      role: "assistant",
      content:
        "היי 😀👋, מחלקת שירות הלקוחות שלנו פועלת ב-WhatsApp / אימייל בלבד. פונה אליך בהמשך לשיחתך הטלפונית, איך אוכל לעזור?",
    },
  ]

  it("repeat shipping after premature handoff binds to lookup — not another handoff", () => {
    const hints = buildConversationHints({ body: REPEAT_BODY, history: repeatHistory }) ?? ""
    assert.match(hints, /REPEAT SHIPPING AFTER PREMATURE HANDOFF \(534269217\)/)
    assert.match(hints, /SO26024984/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /Never "לא יכול להציג"/)
  })

  it("prompt teaches repeat shipping after premature handoff", () => {
    const line = prompt.split("\n").find((l) => l.includes("Repeat shipping after premature handoff"))
    assert.ok(line, "missing repeat shipping rule for 534269217")
    assert.match(line!, /lookup_order_status/)
    assert.match(line!, /534269217/)
  })

  it("repeat bad reply handed off again without lookup", () => {
    assert.match(REPEAT_BAD_REPLY, /לא יכול להציג/)
    assert.match(REPEAT_BAD_REPLY, /מעביר/)
  })
})
