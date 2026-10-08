import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  INACTIVITY_HANDOFF_AUTO_ASSIGN_MS,
  INACTIVITY_PING_MS,
} from "@/lib/agents/inactivity"
import {
  resolveInactivityPingDelayMs,
  shouldSilentAutoAssignOnQuietWindow,
} from "@/lib/agents/inactivity-policy"
import { resolveInactivityHandoffAction } from "@/lib/landbot/inactivity-handoff-recovery"
import type { HistoryMessage } from "@/lib/agents/types"

/** 532185810 / 532619558 — open handoff offer waits for customer confirm, not silent assign. */
describe("handoff quiet-window silent assign", () => {
  const handoffOfferHistory: HistoryMessage[] = [
    { role: "user", content: "רוצה לדבר עם נציג" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nאוקיי, האם להעביר את הפנייה לנציג שירות?",
    },
  ]

  it("uses normal ping delay when handoff offer awaits confirm", () => {
    assert.equal(
      resolveInactivityPingDelayMs(handoffOfferHistory, "faq"),
      INACTIVITY_PING_MS
    )
    assert.equal(
      resolveInactivityPingDelayMs(
        [{ role: "user", content: "שעות סניפים?" }],
        "faq"
      ),
      INACTIVITY_PING_MS
    )
  })

  it("does not silent-assign an open handoff offer without confirm", () => {
    assert.equal(
      shouldSilentAutoAssignOnQuietWindow(handoffOfferHistory, "faq"),
      false
    )
    assert.equal(
      resolveInactivityHandoffAction(handoffOfferHistory, "faq"),
      "human_service"
    )
  })

  it("includes service summary awaiting confirm", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nמסכם את הפנייה עבור נציג שירות:\n• SO123\n\nאני צודק?",
      },
    ]
    assert.equal(shouldSilentAutoAssignOnQuietWindow(history, "service"), true)
    assert.equal(resolveInactivityHandoffAction(history, "service"), "human_service")
  })
})
