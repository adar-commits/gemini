import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isTransferPromisedInThread } from "@/lib/agents/human-waiting"
import {
  isWaitingForHumanRepReply,
} from "@/lib/agents/inactivity"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

function historyThroughCompensationChase(): HistoryMessage[] {
  return [
    { role: "user", content: "לא עזרת" },
    { role: "user", content: "הבטיחו לי שזה פה תוך שבעה ימי עסקים" },
    { role: "user", content: "עם מי אפשר לדבר?" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מבין שחיכית… השטיח הועמס לשליח היום ב-09:07… העברתי את השיחה לנציג שירות, והוא ימשיך איתך לגבי הזמנה SO26024857 וזמן ההגעה.",
    },
    {
      role: "user",
      content:
        "שלום לכם… עברו כבר 10 ימי עסקים… עכשיו הוא הגיע באיחור מבקשת פיצוי",
    },
  ]
}

/** Replay 534870363 — waiting ping after handoff must not replay shipping lookup prose. */
describe("late delivery compensation wait ping (534870363)", () => {
  it("detects מחכה למענה as waiting-for-rep", () => {
    assert.equal(isWaitingForHumanRepReply("מחכה למענה!"), true)
  })

  it("treats העברתי את השיחה as transfer promised in thread", () => {
    const history = historyThroughCompensationChase()
    assert.equal(isTransferPromisedInThread(history), true)
  })

  it("pre-turn handoffs on wait ping without generic help offer", () => {
    const history = historyThroughCompensationChase()
    const result = runPreTurnGuards({
      turn: { text: "מחכה למענה!", media: [] },
      history,
      customerName: undefined,
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "human_service")
    assert.doesNotMatch(result.reply, /הועמס לשליח/)
    assert.doesNotMatch(result.reply, /תיקון קטן/)
  })
})
