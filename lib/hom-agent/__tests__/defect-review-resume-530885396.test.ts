import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isOpenServiceDefectFollowUpThread } from "@/lib/agents/service-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

function history530885396BeforeResume(): HistoryMessage[] {
  return [
    { role: "user", content: "השטיח שרכשתי נפרם בכמה מקומות" },
    {
      role: "assistant",
      content:
        "לאחר התייעצות יש לגשת עם השטיח לסניף הקרוב/ או למחסני החברה בקרית שדה התעופה לצורך ביקורת. השטיח יעבור בדיקה אצל מחלקת ביקורות שלנו",
    },
    { role: "user", content: "האם אפשר לשלוח שליח שיקח את השטיח ?" },
    {
      role: "assistant",
      content: "שליח יצור קשר בשבוע הבא לאיסוף השטיח למחסן",
    },
    {
      role: "assistant",
      content:
        "תיקון שטיח יכול לקחת עד 3 שבועות אצל מנהלת בקרת איכות ואיש מקצוע.",
    },
    { role: "user", content: "האם הביקורת קיבלה את השטיח שלנו?" },
    { role: "user", content: "שלום" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* שלום נטע! אפשר לחזור לשטיח שנפרם, או שהפעם מדובר במשהו אחר?",
    },
    { role: "user", content: "לחזור לשטיח שנפרם" },
  ]
}

/** Replay 530885396 — defect at warehouse review; must not restart photo + SO intake. */
describe("defect review resume 530885396", () => {
  it("detects open defect follow-up after warehouse pickup/review", () => {
    assert.equal(isOpenServiceDefectFollowUpThread(history530885396BeforeResume()), true)
  })

  it("hints skip re-intake when customer resumes fray case", () => {
    const hints =
      buildConversationHints({
        history: history530885396BeforeResume(),
        body: "זו ההזמנה השטיח אצלכם בביקורת",
      }) ?? ""
    assert.match(hints, /SERVICE DEFECT REVIEW IN PROGRESS \(530885396\)/)
    assert.match(hints, /Never.*restart full intake/i)
    assert.match(hints, /human_service/)
  })
})
