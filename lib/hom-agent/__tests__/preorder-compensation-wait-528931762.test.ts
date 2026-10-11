import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { isNonSubstantiveFollowUp } from "@/lib/agents/conversation-close"
import { isOpenPreorderDelayCompensationFollowUpThread } from "@/lib/agents/service-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

function history528931762(): HistoryMessage[] {
  return [
    { role: "user", content: "לי אמרו שזה יגיע ב10/10" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מבין שציפיתם לקבל אותו כבר. לפי המערכת, גירף קרם 190*140 הוא בהזמנה מוקדמת, וצפי חידוש המלאי שלו הוא 29/10/2026. נציג שירות יבדוק את המועד שנאמר לכם (10/10) ויחזור אליכם לגבי ההזמנה (מס׳ 75008).",
    },
    { role: "user", content: "יש עיכוב בהזמנה והשטיח יותר זול ממה שאני קניתי" },
    { role: "user", content: "עם יש עיכוב אני אמורה לקבל פיצוי" },
  ]
}

/** Replay 528931762 — wait chase on pre-order delay must recap compensation/price, not ETA only. */
describe("preorder compensation wait ping 528931762", () => {
  it("detects open pre-order delay compensation thread", () => {
    assert.equal(isOpenPreorderDelayCompensationFollowUpThread(history528931762()), true)
  })

  it("treats ? plus short wait line as a non-substantive follow-up", () => {
    assert.equal(isNonSubstantiveFollowUp("?\nאני מחכה לתשובה"), true)
  })

  it("prompt binds handoff recap to pre-order delay + compensation asks", () => {
    const line = prompt.split("\n").find((l) => l.includes("Handoff recap freshness"))
    assert.ok(line)
    assert.match(line!, /528931762/)
    assert.match(line!, /compensation|פיצוי/i)
  })

  it("wait ping hint requires full service recap including compensation", () => {
    const hints =
      buildConversationHints({
        history: history528931762(),
        body: "?\nאני מחכה לתשובה",
      }) ?? ""
    assert.match(hints, /PREORDER DELAY WAIT PING \(528931762\)/)
    assert.match(hints, /פיצוי/)
    assert.match(hints, /human_service/)
    assert.match(hints, /never.*only repeat stock ETA/i)
  })
})
