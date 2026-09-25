import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isSalesOutreachTemplateMessage,
  salesOutreachTemplateInThread,
} from "@/lib/agents/sales-outreach"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const MEIR_OUTREACH = `היי 👋,
ראיתי שלא השלמת את הרכישה שלך באתר שלנו -
אשמח לעזור לך להשלים אותה.

שמי מאיר, ניתן לפנות אלי ישירות לכאן: 0547109174 🙏`

const history533322535: HistoryMessage[] = [
  { role: "assistant", content: MEIR_OUTREACH },
  {
    role: "user",
    content: "אני מתלבטת לגבי התבע\nהצבע מחכה שהספה תגיע\nעד מתי המבצע",
  },
]

describe("sales outreach assign 533322535", () => {
  it("detects Meir abandoned-cart outreach template", () => {
    assert.equal(isSalesOutreachTemplateMessage(MEIR_OUTREACH), true)
    assert.equal(salesOutreachTemplateInThread(history533322535), true)
  })

  it("hints sales thread — not service handoff", () => {
    const hints = buildConversationHints({
      history: history533322535,
      body: history533322535[1]!.content,
    })
    assert.ok(hints)
    assert.match(hints, /SALES OUTREACH \(533322535\)/)
    assert.match(hints, /action human_sales \+ crm_department sales/)
    assert.match(hints, /Never human_service \/ נציג שירות/)
  })

})
