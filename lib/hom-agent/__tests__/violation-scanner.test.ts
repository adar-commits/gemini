import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  scanMessagesForViolations,
  selectViolationsForQa,
  type ScannedMessage,
  type ViolationFinding,
} from "@/lib/hom-agent/violation-scanner"

function row(
  id: string,
  role: "user" | "assistant",
  content: string,
  action: string | null,
  minute: number,
  conversationId = "c1"
): ScannedMessage {
  return {
    id,
    conversation_id: conversationId,
    role,
    content,
    action,
    created_at: new Date(Date.UTC(2026, 8, 25, 10, minute)).toISOString(),
  }
}

function finding(
  conversationId: string,
  messageId: string,
  action: string | null,
  minute: number
): ViolationFinding {
  return {
    type: "transfer_words_reply_action",
    conversationId,
    messageId,
    createdAt: new Date(Date.UTC(2026, 8, 25, 10, minute)).toISOString(),
    userText: "u",
    botReply: "b",
    action,
    detail: "d",
  }
}

describe("violation scanner", () => {
  it("flags transfer wording when no handoff happened", async () => {
    const result = await scanMessagesForViolations([
      row("u1", "user", "המוצר הגיע פגום", null, 1),
      row("a1", "assistant", "אני מעביר את הפנייה לנציג שירות", "reply", 2),
    ])
    assert.equal(result.violations.length, 1)
    assert.equal(result.violations[0].type, "transfer_words_reply_action")
  })

  it("does not flag a follow-up after a real handoff", async () => {
    const result = await scanMessagesForViolations([
      row("u1", "user", "המוצר הגיע פגום", null, 1),
      row("a1", "assistant", "מעביר לנציג שירות", "human_service", 2),
      row("u2", "user", "מתי יחזרו אליי?", null, 3),
      row("a2", "assistant", "העברתי את הפנייה, הנציג יחזור אליכם", "reply", 4),
    ])
    assert.equal(
      result.violations.filter((v) => v.type === "transfer_words_reply_action").length,
      0
    )
  })

  it("sends only silent failures, one per chat, newest first, capped", () => {
    const picked = selectViolationsForQa(
      [
        finding("c1", "m1", "reply", 1),
        finding("c1", "m2", "reply", 5),
        finding("c2", "m3", "human_service", 6),
        finding("c3", "m4", "reply", 3),
        finding("c4", "m5", "reply", 2),
      ],
      2
    )
    assert.deepEqual(
      picked.map((f) => f.messageId),
      ["m2", "m4"]
    )
  })
})
