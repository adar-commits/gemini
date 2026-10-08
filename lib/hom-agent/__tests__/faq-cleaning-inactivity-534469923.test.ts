import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { hasOpenFaqFollowUpQuestion } from "@/lib/agents/inactivity-policy"
import type { HistoryMessage } from "@/lib/agents/types"

/** 534469923 — rug cleaning FAQ + model question; 15m silence must not silent-handoff. */
describe("faq cleaning inactivity 534469923", () => {
  const cleaningReply =
    "*הום בוט :)* בשמחה איתן 🙂 את רוב השטיחים שלנו מנקים ככה: • *כתם נקודתי* – מנגבים במגבון בלי אלכוהול, או במטלית מיקרופייבר עם מים חמים וסבון כלים, בתנועה סיבובית. • *ניקוי כללי* – ניקוי יבש מקצועי. יש גם שטיחים שמתאימים לכביסה, ותלוי בדגם. יש דגם מסוים שראית באתר?"

  const history: HistoryMessage[] = [
    { role: "user", content: "היי" },
    { role: "assistant", content: "*הום בוט :)* היי איתן! 😊 במה אפשר לעזור?", agent: "faq" },
    { role: "user", content: "רציתי שטיח ואני רוצה לדעת איך מנקים אותו" },
    { role: "assistant", content: cleaningReply, agent: "faq" },
  ]

  it("detects open FAQ model question — no silent handoff", () => {
    assert.equal(hasOpenFaqFollowUpQuestion(history, "faq"), true)
  })

  it("does not treat handoff offer as open FAQ question", () => {
    const handoffHistory: HistoryMessage[] = [
      ...history.slice(0, -1),
      {
        role: "assistant",
        content: "*הום בוט :)* האם להעביר ליועץ מכירות שיבדוק ויאמת?",
        agent: "faq",
      },
    ]
    assert.equal(hasOpenFaqFollowUpQuestion(handoffHistory, "faq"), false)
  })
})
