import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import { validateHomAgentReply } from "@/lib/hom-agent/validate-reply"

/** 533502989 — size exchange without original packaging → human_sales; no "message cut off" tail on handoff. */
describe("handoff reply skips truncation completion tail (533502989)", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "נכון אבל אני רוצה להחליף למידה פחות" },
    {
      role: "assistant",
      content:
        "הבנתי, אז נחליף לאותו דגם ובאותו צבע, רק במידה קטנה יותר. איזו מידה תרצי?",
    },
    {
      role: "user",
      content: "אין אריזה מקורית פתחנו שמנו בסלון וראינו שגדול מידי ומיד קיפלנו בחזרה",
    },
  ]
  const userText = history[2]!.content
  const truncated =
    "תודה שסיפרת, ליהי. בדרך כלל החלפה מתבצעת כשהשטיח ללא שימוש ובאריזתו המקורית. " +
    "לא אוכל להבטיח מראש שההחלפה תאושר בלי האריזה, אבל ציינתי שרק פרשתם אותו לבדיקה וקיפלתם מיד. " +
    "היועץ יבדוק את זה ויעזור לך לבחור מידה קטנה יותר לס"

  it("human_sales handoff gets no 'נקטעה' tail", () => {
    const out = validateHomAgentReply(
      { action: "human_sales", reply: truncated } as Parameters<typeof validateHomAgentReply>[0],
      userText,
      null,
      history
    )
    assert.equal(out.action, "human_sales")
    assert.doesNotMatch(out.reply ?? "", /נקטעה/)
    assert.doesNotMatch(out.reply ?? "", /לס$/)
    assert.match(out.reply ?? "", /ציינתי שרק פרשתם/)
  })

  it("human_service handoff gets no 'נקטעה' tail", () => {
    const out = validateHomAgentReply(
      { action: "human_service", reply: truncated } as Parameters<typeof validateHomAgentReply>[0],
      userText,
      null,
      history
    )
    assert.doesNotMatch(out.reply ?? "", /נקטעה/)
  })

  it("plain reply still gets the completion tail", () => {
    const out = validateHomAgentReply(
      { action: "reply", reply: truncated } as Parameters<typeof validateHomAgentReply>[0],
      userText,
      null,
      history
    )
    assert.match(out.reply ?? "", /נקטעה/)
  })
})
