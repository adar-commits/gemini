import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { shouldSkipInactivityPingForSalesHandoff } from "@/lib/agents/inactivity-policy"
import {
  isServiceOrderIdentificationFlow,
} from "@/lib/agents/order-lookup"
import type { HistoryMessage } from "@/lib/agents/types"

describe("Taltul-style service order confirm", () => {
  const sheddingHistory: HistoryMessage[] = [
    { role: "user", content: "היי" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nשלום! במה אוכל לעזור?",
    },
    {
      role: "user",
      content:
        "קניתי שטיח לפני 3 שבועות ויורדים ממנו סיבים — זה תקין או שיש פה בעיה?",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nזה יכול להיות נורmal shedding… אפשר לשלוח תמונה?",
    },
    { role: "user", content: "[media:image:photo1.jpg]" },
    {
      role: "assistant",
      content: "*הום בוט :)*\nתודה. מה מספר ההזמנה?",
    },
    { role: "user", content: "#75549" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nנדמה לי שמצאתי את ההזמנה (מס' הזמנה 75549) מ-23 ימים… האם מדובר על הזמנה זו?",
    },
  ]

  it("detects service order identification after shedding + photos", () => {
    assert.equal(
      isServiceOrderIdentificationFlow(sheddingHistory, "נכון"),
      true
    )
  })

  it("skips inactivity ping while service handoff offer is pending", () => {
    const history: HistoryMessage[] = [
      ...sheddingHistory,
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nהאם להעביר את הפנייה לנציג שירות שיבדוק ויחזור אליכם?",
      },
    ]
    assert.equal(shouldSkipInactivityPingForSalesHandoff(history, "faq"), true)
  })
})
