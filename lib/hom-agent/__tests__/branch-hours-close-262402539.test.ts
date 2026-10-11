import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isBranchOpeningHoursOfferPending } from "@/lib/agents/branches"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

/** Replay 262402539 — branch hours + manager contact after confirm must action end. */
describe("branch hours close 262402539", () => {
  const history: HistoryMessage[] = [
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nהיי נופר! 😊\n\nכן, הסניף החדש של השטיח האדום בביג באר שבע כבר פתוח, ואפשר לבוא לראות מקרוב את קולקציית winter 2027. הקפה עלינו\n\nלשלוח לך את שעות הפתיחה של הסניף?",
    },
  ]

  const body = "כן תודה רבה ואת איש הקשר של מנהל הסניף"

  it("detects branch opening-hours offer pending from bot question", () => {
    assert.equal(isBranchOpeningHoursOfferPending(history), true)
  })

  it("hints action end after full branch FAQ answer", () => {
    const hints = buildConversationHints({ body, history }) ?? ""
    assert.match(hints, /262402539/)
    assert.match(hints, /BRANCH HOURS CONFIRM/i)
    assert.match(hints, /action: end/i)
  })
})
