import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  INACTIVITY_HANDOFF_AUTO_ASSIGN_MS,
  INACTIVITY_PING_MS,
} from "@/lib/agents/inactivity"
import {
  resolveInactivityPingDelayMs,
  shouldSilentAutoAssignOnQuietWindow,
} from "@/lib/agents/inactivity-policy"
import { isHumanHandoffOfferPending } from "@/lib/agents/off-topic"
import type { HistoryMessage } from "@/lib/agents/types"

/** Replay 532619558 — ETA frustration, proactive handoff offer, no customer confirm. */
describe("delivery handoff no silent assign (532619558)", () => {
  const handoffOffer = `*הום בוט :)*
מבין שאתה מחכה כבר הרבה זמן, דניאל. לפי המערכת ההזמנה #77066 ממתינה להפצה מהמחסן, ואין בה עדיין תאריך הפצה מדויק. כשהיא תצא, חברת השליחויות תתקשר אליך ביום האספקה. עבר כבר זמן רב, אז עדיף שנציג שירות יבדוק את ההזמנה שלך באופן אישי. להעביר אותך אליו?`

  const history: HistoryMessage[] = [
    { role: "user", content: "כמה זמן ההפצה? המון!" },
    {
      role: "assistant",
      content: handoffOffer,
      agent: "faq",
      awaiting: "handoff_confirm",
    },
  ]

  it("detects open handoff offer after proactive FAQ reply", () => {
    assert.equal(isHumanHandoffOfferPending(history), true)
    const textOnlyHistory: HistoryMessage[] = [
      { role: "user", content: "כמה זמן ההפצה? המון!" },
      { role: "assistant", content: handoffOffer, agent: "faq" },
    ]
    assert.equal(isHumanHandoffOfferPending(textOnlyHistory), true)
  })

  it("does not silent auto-assign without explicit rep request or confirm", () => {
    assert.equal(shouldSilentAutoAssignOnQuietWindow(history, "faq"), false)
    assert.equal(resolveInactivityPingDelayMs(history, "faq"), INACTIVITY_PING_MS)
    assert.notEqual(resolveInactivityPingDelayMs(history, "faq"), INACTIVITY_HANDOFF_AUTO_ASSIGN_MS)
  })
})
