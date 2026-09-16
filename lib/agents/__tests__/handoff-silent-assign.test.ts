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

/** 532185810 — handoff offer without customer confirm → silent CRM assign after 1 min. */
describe("handoff quiet-window silent assign", () => {
  const handoffOfferHistory: HistoryMessage[] = [
    { role: "user", content: "רוצה לדבר עם נציג" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nאוקיי, האם להעביר את הפנייה לנציג שירות?",
    },
  ]

  it("uses 1-minute delay when handoff offer is pending", () => {
    assert.equal(
      resolveInactivityPingDelayMs(handoffOfferHistory, "faq"),
      INACTIVITY_HANDOFF_AUTO_ASSIGN_MS
    )
    assert.equal(
      resolveInactivityPingDelayMs(
        [{ role: "user", content: "שעות סניפים?" }],
        "faq"
      ),
      INACTIVITY_PING_MS
    )
  })

  it("detects pending handoff queue for silent assign", () => {
    assert.equal(
      shouldSilentAutoAssignOnQuietWindow(handoffOfferHistory, "faq"),
      true
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
