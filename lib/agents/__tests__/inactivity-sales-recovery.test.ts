import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { shouldSkipInactivityClose } from "@/lib/agents/inactivity-policy"
import type { HistoryMessage } from "@/lib/agents/types"

describe("inactivity sales recovery policy", () => {
  it("routes mid-intake sales threads to human_sales recovery instead of close", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "יש לכם בסגנון" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nמעולה — לאיזה חלל בבית מיועד השטיח? (סלון, חדר שינה וכו')",
        agent: "faq",
      },
      { role: "user", content: "סלון" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nמצטער, אני מודל AI ולא יכול להאזין להודעות קול.",
        agent: "faq",
      },
      {
        role: "assistant",
        content: "*הום בוט :)*\nEti Ohana, עדיין כאן?",
        agent: "master",
      },
    ]
    assert.equal(shouldSkipInactivityClose(history, "faq"), true)
  })
})
