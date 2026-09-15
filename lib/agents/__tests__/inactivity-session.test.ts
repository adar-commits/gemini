import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { botIsWaitingFromTimestamps } from "@/lib/agents/inactivity-session"

describe("inactivity session waiting", () => {
  it("treats assistant-after-user timestamps as waiting", () => {
    assert.equal(
      botIsWaitingFromTimestamps({
        last_user_at: "2026-09-15T11:46:17.805Z",
        last_assistant_at: "2026-09-15T11:46:17.806Z",
      }),
      true
    )
  })

  it("treats user-after-assistant timestamps as not waiting", () => {
    assert.equal(
      botIsWaitingFromTimestamps({
        last_user_at: "2026-09-15T11:46:18.000Z",
        last_assistant_at: "2026-09-15T11:46:17.806Z",
      }),
      false
    )
  })
})
