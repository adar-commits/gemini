import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  shouldSilentAutoAssignOnQuietWindow,
  shouldSkipInactivityClose,
  shouldSkipInactivityPingForSalesHandoff,
} from "@/lib/agents/inactivity-policy"
import { isOrderNumberRequestPending } from "@/lib/agents/order-lookup"
import { resolveInactivityHandoffAction } from "@/lib/landbot/inactivity-handoff-recovery"
import type { HistoryMessage } from "@/lib/agents/types"

const ORDER_ASK =
  "*הום בוט :)* היי מרים! כדי שאוכל לבדוק את סטטוס המשלוח, יש לך מספר הזמנה? (למשל #36805) אם אין, כתבי לי ואאתר לפי מספר הטלפון שממנו את מתכתבת."

/** 364877814 — shipping ETA + order ask must not silent-assign human_sales from stale sales thread. */
describe("shipping eta order pending inactivity 364877814", () => {
  const history: HistoryMessage[] = [
    {
      role: "user",
      content:
        "היי, אשמח לקבל עדכון כשהמידה XL - 200*290 של שטיח סלוניקי 14 שחור עם פרנזים SALONIKI חוזרת למלאי",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי מרים! אין לי אפשרות לרשום מכאן התראה על חזרה למלאי. רשמתי את הבקשה שלך לשטיח סלוניקי 14 שחור עם פרנזים במידה XL 200*290. יועץ מכירות יבדוק מתי המידה צפויה לחזור ויעדכן אותך.",
    },
    { role: "user", content: "היי, מה מצפי לקבלת המשלוח?" },
    { role: "assistant", content: ORDER_ASK },
  ]

  it("detects open order-number ask after shipping ETA", () => {
    assert.equal(isOrderNumberRequestPending(history), true)
  })

  it("does not treat stale sales thread as sales silent handoff while order id is pending", () => {
    assert.equal(shouldSkipInactivityPingForSalesHandoff(history, "faq"), false)
    assert.equal(shouldSilentAutoAssignOnQuietWindow(history, "faq"), false)
    assert.equal(shouldSkipInactivityClose(history, "faq"), false)
  })

  it("routes recovery to service if shipping order lookup is still open", () => {
    assert.equal(resolveInactivityHandoffAction(history, "faq"), "human_service")
  })
})
