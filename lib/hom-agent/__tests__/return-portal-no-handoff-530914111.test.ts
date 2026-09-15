import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildDissatisfactionRescueReply } from "@/lib/agents/dissatisfaction"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

/** Replay 530914111 / 0505205897 — return/refund via portal must not proactively offer handoff. */
describe("return portal self-service (530914111)", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "אני מבקשת להחזיר את השטיח לחנות." },
    {
      role: "assistant",
      content: buildDissatisfactionRescueReply("0505205897"),
    },
    { role: "user", content: "צריכה הובלה" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nכדי לתאם את האיסוף, יש לפתוח בקשת החזרה בפורטל:\nhttps://returns.carpetshop.co.il/?phone=0505205897",
    },
  ]

  it("hints no proactive handoff when customer asks for refund after portal steps", () => {
    const hints = buildConversationHints({
      body: "אני מבקשת החזר כספי",
      history,
      whatsappPhone: "0505205897",
    })
    assert.match(hints ?? "", /RETURN PORTAL SELF-SERVICE|portal self-service/i)
    assert.match(hints ?? "", /נתקעים|passive|Never.*רוצים שאעביר/i)
    assert.doesNotMatch(hints ?? "", /rep summary → human_service/i)
  })

  it("hints acknowledgment binding when customer confirms after passive help", () => {
    const hints = buildConversationHints({
      body: "לא מעוניינת בשטיח בכלל. ולא במה שיש שם.",
      history: [
        ...history,
        {
          role: "assistant",
          content:
            "*הום בוט :)*\nיש לפתוח בקשה בפורטל:\nhttps://returns.carpetshop.co.il/?phone=0505205897\n\nאם נתקעים בפתיחת הבקשה — אפשר לכתוב כאן ונעזור.",
        },
      ],
      whatsappPhone: "0505205897",
    })
    assert.match(hints ?? "", /acknowledgment, not handoff/i)
  })
})
