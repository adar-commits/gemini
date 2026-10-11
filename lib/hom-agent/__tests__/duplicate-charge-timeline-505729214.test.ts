import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  isDuplicateChargeRefundTimelineFollowUp,
  isOpenDuplicateChargeServiceThread,
} from "@/lib/agents/payment-intent"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const PRIOR_HANDOFF =
  "*הום בוט :)* מעולה, העברתי את השיחה לנציג שירות. הפנייה שלך על החיוב הכפול רשומה אצלנו עם כל הפרטים."

function history505729214(): HistoryMessage[] {
  return [
    {
      role: "user",
      content: "ישנו חיוב כפול של 490₪",
    },
    { role: "user", content: "?" },
    { role: "assistant", content: PRIOR_HANDOFF },
  ]
}

/** Replay 505729214 — refund date chase after duplicate-charge handoff must not re-handoff. */
describe("duplicate charge timeline follow-up 505729214", () => {
  it("detects open duplicate charge service thread", () => {
    assert.equal(isOpenDuplicateChargeServiceThread(history505729214()), true)
  })

  it("detects timeline follow-up after prior handoff", () => {
    assert.equal(
      isDuplicateChargeRefundTimelineFollowUp(
        history505729214(),
        "אשמח לדעת מתי מחזירים לי את החיוב הכפול"
      ),
      true
    )
  })

  it("timeline follow-up hints reply — not duplicate human_service", () => {
    const hints =
      buildConversationHints({
        history: history505729214(),
        body: "אשמח לדעת מתי מחזירים לי את החיוב הכפול",
      }) ?? ""
    assert.match(hints, /DUPLICATE CHARGE TIMELINE FOLLOW-UP \(505729214\)/)
    assert.match(hints, /action: reply/i)
    assert.match(hints, /never.*human_service/i)
    assert.match(hints, /העברתי עכשיו/)
  })

  it("prompt teaches duplicate charge timeline after handoff", () => {
    const line = prompt.split("\n").find((l) => l.includes("Duplicate charge timeline after handoff (505729214)"))
    assert.ok(line)
    assert.match(line!, /action: reply/)
    assert.match(line!, /Never.*human_service/i)
  })
})
