import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isInactivityStillHereReply } from "@/lib/agents/inactivity"
import type { HistoryMessage } from "@/lib/agents/types"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"

describe("532860676 inactivity still-here after delivery status", () => {
  const deliveryHistory: HistoryMessage[] = [
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nזה מסתדר עם מה שאמרו לך בחנות. ההזמנה כבר יצאה מהמחסן ונמצאת אצל חברת השליחויות, אז היא בדרך אלייך, והשליח יתקשר אלייך ביום האספקה. אם יעברו 10 הימים והשטיח עדיין לא הגיע, נציג שירות כבר מטפל בבקשה שלך ויבדוק את זה מול חברת השליחויות.",
      agent: "faq",
    },
    {
      role: "assistant",
      content: "*הום בוט :)*\nTatiana, עדיין כאן?",
      agent: "master",
    },
  ]

  it("treats יכן typo as still-here reply", () => {
    assert.equal(isInactivityStillHereReply("יכן"), true)
  })

  it("pre-turn acks presence instead of human_service handoff", () => {
    const result = runPreTurnGuards({
      turn: { text: "יכן", media: [] },
      history: deliveryHistory,
      customerName: "Tatiana",
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "reply")
    assert.match(result.reply, /איך אוכל להמשיך לעזור/)
    assert.doesNotMatch(result.reply, /נציג שירות יבדוק/)
  })
})
