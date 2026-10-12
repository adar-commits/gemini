import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isOpenPostPurchaseServiceIssueInThread } from "@/lib/agents/service-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const OPENING =
  "קיבלתי את הפופים של פוזיטיב ב5.8 פתחתי אותם לפני כשבועיים במעבר דירה נוכחתי לגלות שהפופ מגיע בנפרד מהכיסוי לאחר מספר ניסיונות, ללא הצלחה גם לאחר שנשלח אליי סרטון הוראות, הפופים עדיין קשיחים ולא ניתן לשבת עליהם אני רוצה להחזיר בבקשה את שלושת הפופים על אף שעברו 14 יום"

function history527266764(): HistoryMessage[] {
  return [{ role: "user", content: OPENING }, { role: "user", content: "???" }]
}

/** Replay 527266764 — wait ping after pop defect/return must not pivot to delivered FAQ. */
describe("service return wait ping 527266764", () => {
  it("detects open post-purchase service issue from prior user report", () => {
    assert.equal(isOpenPostPurchaseServiceIssueInThread(history527266764()), true)
  })

  it("?? wait ping hints service continuation — not shipping delivered close", () => {
    const hints =
      buildConversationHints({
        history: history527266764(),
        body: "???",
      }) ?? ""
    assert.match(hints, /SERVICE CASE WAIT PING \(527266764\)/)
    assert.match(hints, /Never.*משלוח נמסר/i)
    assert.doesNotMatch(hints, /ORDER STATUS OPENING/)
  })
})
