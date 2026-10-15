import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  resolveInactivityPingDelayMs,
  shouldSilentAutoAssignOnQuietWindow,
} from "@/lib/agents/inactivity-policy"
import { INACTIVITY_HANDOFF_AUTO_ASSIGN_MS, INACTIVITY_PING_MS } from "@/lib/agents/inactivity"
import type { HistoryMessage } from "@/lib/agents/types"

/** 431273377 — after branch stock ask bot requested מק״ט; ~60s silent human_sales fired with no user reply. */
describe("branch stock sku pending inactivity 431273377", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "היי", agent: null },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי עדית! אם את עדיין מחפשת את ונוס קרם-אפור, שלחי לי את המק״ט של המידה שאת רוצה ואת האזור שנוח לך, ואבדוק באיזה סניף יש מלאי.",
      agent: "faq",
    },
    { role: "user", content: "האם יש את זה בסניף בבאר שבע ?", agent: null },
    {
      role: "assistant",
      content:
        "*הום בוט :)* בשמחה, אבדוק לך בסניף באר שבע (המשק 1, מתחם ביג) כדי לבדוק אני צריך את המק״ט של המידה שאת רוצה. הוא מופיע בעמוד המוצר באתר, למשל 31503138-200290. אם קשה לך למצוא אותו, כתבי לי רק איזו מידה את מחפשת.",
      agent: "faq",
    },
  ]

  it("does not silent-assign human_sales while מק״ט is pending", () => {
    assert.equal(shouldSilentAutoAssignOnQuietWindow(history, "faq"), false)
    assert.notEqual(resolveInactivityPingDelayMs(history, "faq"), INACTIVITY_HANDOFF_AUTO_ASSIGN_MS)
    assert.equal(resolveInactivityPingDelayMs(history, "faq"), INACTIVITY_PING_MS)
  })
})
