import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import {
  isAwaitingReplyAfterOrderStatusLookupOffer,
  shouldSilentAutoAssignOnQuietWindow,
} from "@/lib/agents/inactivity-policy"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

const CUSTOMER =
  "האם אני יכולה לראות שטיחים באזורי בקריות אתא.אני רכשתי לפני שבועים ועדין לא קיבלתי ומעוניינת לראות בחנות המותג.תודה"

const FAQ_BRANCH_AND_STATUS_OFFER =
  "*הום בוט :)* בטח ריקי יש לנו סניף בקריית אתא, שם אפשר לראות ולהרגיש את השטיחים: דרך חיפה 44, מתחם Redesign טלפון: 054-9154541 א'-ה' 09:30-19:30, ו' 09:00-14:00 (היום פתוח עד 14:00) אם חשוב לך לראות דווקא את בל קרם, כדאי להתקשר לסניף לפני ההגעה ולוודא שהוא בתצוגה. ולגבי ההזמנה שעוד לא הגיעה, מבין שחיכית. רוצה שאבדוק עכשיו מה הסטטוס שלה?"

/** Replay 533759845 — branch FAQ + status offer must not silent-assign human_sales. */
describe("533759845 branch FAQ status offer inactivity", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: CUSTOMER },
    { role: "assistant", content: FAQ_BRANCH_AND_STATUS_OFFER, agent: "faq" },
  ]

  it("detects awaiting reply after status lookup offer", () => {
    assert.equal(isAwaitingReplyAfterOrderStatusLookupOffer(history), true)
  })

  it("blocks silent sales handoff while status offer is open", () => {
    assert.equal(shouldSilentAutoAssignOnQuietWindow(history, "faq"), false)
  })

  it("binds STATUS LOOKUP OFFER AFTER FAQ hint — never human_sales", () => {
    const hints = buildConversationHints({ history, body: CUSTOMER }) ?? ""
    assert.match(hints, /STATUS LOOKUP OFFER AFTER FAQ \(533759845\)/)
    assert.match(hints, /action: end/)
    assert.match(hints, /human_sales/)
  })

  it("has hom-bot binding for 533759845", () => {
    const prompt = readFileSync("lib/hom-agent/prompts/hom-bot.md", "utf8")
    const line = prompt.split("\n").find((l) => l.includes("533759845"))
    assert.ok(line, "missing 533759845 branch-status-offer rule")
    assert.match(line!, /human_sales/)
  })
})
