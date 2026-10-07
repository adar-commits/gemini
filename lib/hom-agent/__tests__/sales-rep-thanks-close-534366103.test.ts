import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { hasLiveRepReplyAfterBotHandoff } from "@/lib/agents/post-handoff"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const BOT_HANDOFF =
  "*הום בוט :)* היי סיון! מכאן אני לא יכול לרשום התראה על חזרה למלאי. אני מעביר את הפנייה ליועץ מכירות. הוא יבדוק מתי שטיח בל קרם (BELL) במידה L – 160*230 צפוי לחזור למלאי ויעדכן אותך"

function historyBeforeThanks(): HistoryMessage[] {
  return [
    {
      role: "user",
      content:
        "היי, אשמח לקבל עדכון כשהמידה L - 160*230 של שטיח בל קרם BELL חוזרת למלאי",
    },
    { role: "assistant", content: BOT_HANDOFF },
    { role: "assistant", content: "היי לא יחזור למלאי.." },
    {
      role: "assistant",
      content:
        "https://www.carpetshop.co.il/products/firnze-01-cream?variant=42072742953151 זה דומה",
    },
  ]
}

/** Replay 534366103 — thanks after live sales rep answered must warm-close, not re-handoff. */
describe("sales rep thanks close 534366103", () => {
  it("detects live rep reply after bot sales handoff", () => {
    assert.equal(hasLiveRepReplyAfterBotHandoff(historyBeforeThanks()), true)
  })

  it("pre-turn warm-closes on thanks after rep answered", () => {
    const result = runPreTurnGuards({
      turn: { text: "תודה", media: [] },
      history: historyBeforeThanks(),
      customerName: "סיון",
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "end")
    assert.doesNotMatch(result.reply, /העברתי/)
    assert.doesNotMatch(result.reply, /מעולה/)
    assert.doesNotMatch(result.reply, /יועץ מכירות/)
  })

  it("hints warm close after rep reply — never repeat human_sales", () => {
    const hints = buildConversationHints({
      body: "תודה",
      history: historyBeforeThanks(),
    })
    assert.match(hints ?? "", /534366103/)
    assert.match(hints ?? "", /never.*human_sales/i)
    assert.match(hints ?? "", /action: end/i)
  })
})
