import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { resolveConversationVisit } from "@/lib/agents/conversation-visit"
import { resolveVisitHistory } from "@/lib/agents/memory"
import { buildPostPurchaseAlternateSizeAdvisorReply } from "@/lib/agents/post-purchase-alt-size"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  runPreTurnGuards,
  runStructuredPostPurchaseAltSizePreTurn,
} from "@/lib/hom-agent/pre-turn"

const NOW = new Date("2026-10-09T07:35:10Z")

/** Stored bot thread for 528892655 — Sep 19 exchange visit, then an Oct 9 delivery question. */
const stored = [
  {
    role: "user" as const,
    content:
      "היי, הזמנו מכם 3 שטיחים לבית חדש וקיבלנו לפני בערך חודש.\nאתמול פרסנו אותם ולצערי אחד מהם לא מתאים לחדר...(2 האחרים מהממים)\nאשמח לדעת איך ניתן להחליף אותו- אני אשמח לרכוש שטיח אחר במקומו.",
    at: "2026-09-19T17:02:00Z",
  },
  {
    role: "assistant" as const,
    content: "*הום בוט :)*\nקודם אמצא את ההזמנה שלכם בזריזות, האם היא רשומה על המספר ממנו אני מתכתב כרגע?",
    at: "2026-09-19T17:02:01Z",
  },
  { role: "user" as const, content: "כן\nמוצר לא מתאים", at: "2026-09-19T17:03:21Z" },
  {
    role: "assistant" as const,
    content:
      "*הום בוט :)*\nכרגע אין נציגי שירות זמינים (שעות הפעילות 08:00-16:00), אבל אל דאגה — קיבלנו את הפנייה וניצור איתכם קשר מיד עם חזרת הצוות לזמינות.",
    at: "2026-09-19T17:03:22Z",
  },
]

const fullHistory: HistoryMessage[] = stored.map(({ role, content }) => ({ role, content }))
const turn = (text: string) => ({ text, media: [] })

describe("alt-size pre-turn must not hijack a new visit or loop (528892655)", () => {
  it("scopes structured history to the current visit", () => {
    const visit = resolveConversationVisit(stored, NOW)
    assert.ok(visit)
    assert.deepEqual(resolveVisitHistory(stored, visit, 40), [])
  })

  it("does not answer a delivery question from the past visit's exchange text", () => {
    const visitResult = runStructuredPostPurchaseAltSizePreTurn({
      turn: turn("שלום\nרציתי לדעת מתי יגיע השטיח שהזמנתי?"),
      history: [],
    })
    assert.equal(visitResult.kind, "skip")
  })

  it("never repeats the advisor offer once it was sent", () => {
    const offered: HistoryMessage[] = [
      ...fullHistory,
      { role: "user", content: "רציתי לדעת מתי יגיע השטיח שהזמנתי?" },
      {
        role: "assistant",
        content: buildPostPurchaseAlternateSizeAdvisorReply(),
        awaiting: "handoff_confirm",
      },
    ]
    for (const reply of ["כן", "יועץ"]) {
      const result = runStructuredPostPurchaseAltSizePreTurn({ turn: turn(reply), history: offered })
      assert.equal(result.kind, "skip", reply)
    }
    const confirm = runPreTurnGuards({ turn: turn("כן"), history: offered })
    assert.equal(confirm.kind, "handled")
    if (confirm.kind === "handled") assert.match(confirm.action, /^human_/)
  })
})
