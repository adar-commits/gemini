import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { resolveConversationVisit, type TimedMessage } from "@/lib/agents/conversation-visit"
import { summaryForPrompt } from "@/lib/agents/session-summary"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

/** 228989877 / עינב — June product inquiry with a rep, back in October asking for help with an order. */
const june: TimedMessage[] = [
  { role: "user", content: "היי, אשמח לשמוע פרטים נוספים על פוף ולוטו פרנדלי בז' VELUTO", at: "2026-06-29T17:20:24Z" },
  { role: "user", content: "346963", at: "2026-06-30T05:51:52Z" },
  { role: "assistant", content: "היי\nבאיזו מידה תרצי לרכוש?", at: "2026-06-30T07:04:36Z" },
  { role: "assistant", content: "שנציג מכירות יצור קשר לביצוע רכישה או שיש לך אולי שאלות לפני?", at: "2026-06-30T07:05:35Z" },
]

describe("returning customer visit boundary 228989877", () => {
  it("first message of a new visit, already synced to the CRM, is a fresh visit", () => {
    const visit = resolveConversationVisit(
      [...june, { role: "user", content: "היי", at: "2026-10-08T17:47:32Z" }],
      new Date("2026-10-08T17:48:05Z")
    )
    assert.ok(visit)
    assert.equal(visit.fresh, true)
    assert.equal(visit.anchor, "היי")
    assert.equal(visit.gapDays, 100)
  })

  it("first message not yet in history — boundary is now", () => {
    const visit = resolveConversationVisit(june, new Date("2026-10-08T17:48:05Z"))
    assert.ok(visit)
    assert.equal(visit.fresh, true)
    assert.equal(visit.anchor, null)
  })

  it("later turns of the visit keep the anchor and are no longer fresh", () => {
    const visit = resolveConversationVisit(
      [
        ...june,
        { role: "user", content: "היי", at: "2026-10-08T17:47:32Z" },
        { role: "assistant", content: "*הום בוט :)*\nהיי עינב! איך אפשר לעזור?", at: "2026-10-08T17:48:11Z" },
        { role: "user", content: "איפה ההזמנה שלי", at: "2026-10-08T17:48:57Z" },
      ],
      new Date("2026-10-08T17:49:05Z")
    )
    assert.ok(visit)
    assert.equal(visit.fresh, false)
    assert.equal(visit.anchor, "היי")
  })

  it("no boundary in a continuous thread", () => {
    assert.equal(
      resolveConversationVisit(june.slice(2), new Date("2026-06-30T08:00:00Z")),
      null
    )
  })

  it("hints a fresh visit: do not resume the old product inquiry", () => {
    const visit = resolveConversationVisit(june, new Date("2026-10-08T17:48:05Z"))
    const hints =
      buildConversationHints({
        body: "היי",
        history: june.map(({ role, content }) => ({ role, content })),
        visit,
      }) ?? ""
    assert.match(hints, /NEW VISIT \(228989877\)/)
    assert.match(hints, /30\/06\/2026/)
    assert.match(hints, /fresh inquiry/)
  })

  it("hints the current visit anchor once the bot already answered in it", () => {
    const hints =
      buildConversationHints({
        body: "איפה ההזמנה שלי",
        history: [{ role: "user", content: "היי" }],
        visit: { gapDays: 100, previousVisitAt: "2026-06-30T07:05:35Z", anchor: "היי", fresh: false },
      }) ?? ""
    assert.match(hints, /CURRENT VISIT \(228989877\)/)
    assert.match(hints, /«היי»/)
  })

  it("labels a past-visit summary as background on the fresh-visit turn only", () => {
    const fresh = { gapDays: 100, previousVisitAt: "2026-06-30T07:05:35Z", anchor: "היי", fresh: true }
    assert.match(summaryForPrompt("בקשה נוכחית: פוף ולוטו", fresh) ?? "", /^\(נכתב בביקור קודם, לפני 100 ימים/)
    assert.equal(summaryForPrompt("בקשה נוכחית: הזמנה", { ...fresh, fresh: false }), "בקשה נוכחית: הזמנה")
    assert.equal(summaryForPrompt(null, fresh), null)
  })
})
