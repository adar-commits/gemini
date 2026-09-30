import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  shouldBypassHumanThreadSilence,
  shouldClearHumanThreadOnBypass,
} from "@/lib/agents/off-topic"

// 533738392: bot already transferred (human_sales), the rep offered a restock purchase,
// customer declined the rep — the bot must stay silent and keep the rep's thread.
const history: HistoryMessage[] = [
  {
    role: "user",
    content:
      "היי אשמח לפרטים נוספים לגבי שטיח עלמה 01 בז' ALMA נגמר המלאי? 1.60*2.30 מ'",
  },
  {
    role: "assistant",
    content:
      "*הום בוט :)* היי חגית! אשמח לבדוק לך אם יש מלאי של עלמה 01 בז' במידה 1.60*2.30 בסניפים. כדי לבדוק אני צריך את המק״ט של המידה הזו. הוא מופיע בעמוד המוצר באתר (לדוגמה: 31503138-200290). תוכלי לשלוח לי אותו?",
  },
  { role: "user", content: "אין מקט!" },
  {
    role: "assistant",
    content:
      "*הום בוט :)* אין בעיה חגית, לא צריך מק״ט. אני מעביר את הפנייה ליועץ מכירות. הוא יבדוק אם יש מלאי של עלמה 01 בז' במידה 1.60*2.30 ויחזור אלייך כאן בצ'אט.",
  },
]

describe("rep thread decline after declarative transfer (533738392)", () => {
  it("stays silent and keeps the rep assigned when the customer declines the rep's offer", () => {
    assert.equal(shouldBypassHumanThreadSilence("לא תודה הסתדרתי", history), false)
    assert.equal(shouldClearHumanThreadOnBypass("לא תודה הסתדרתי", history), false)
  })

  it("stays silent on a plain yes to the rep", () => {
    assert.equal(shouldBypassHumanThreadSilence("כן", history), false)
    assert.equal(shouldClearHumanThreadOnBypass("כן", history), false)
  })

  it("still bypasses when the bot's last message is an open handoff offer", () => {
    const offer: HistoryMessage[] = [
      { role: "assistant", content: "אפשר להעביר ליועץ מכירות שיבדוק את המלאי?" },
    ]
    assert.equal(shouldBypassHumanThreadSilence("לא תודה", offer), true)
    assert.equal(shouldBypassHumanThreadSilence("כן", offer), true)
  })
})
