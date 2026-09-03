import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  DEFECT_ISSUE_REPORT_LABEL,
  sanitizeServiceDefectLiabilityReply,
} from "@/lib/agents/service-defect-wording"
import { buildServiceHandoffReportBlock } from "@/lib/agents/service-intake"
import { validateHomAgentReply } from "@/lib/hom-agent/validate-reply"

describe("service defect liability wording", () => {
  it("strips pre-judged defect liability sentences", () => {
    const raw = `*הום בוט :)*
היי! רואים בתמונה חוט בקצה — מבין את החשש.

מכיוון שהשטיח הגיע אתמול במצב הזה, מדובר בפגם שהגיע מלכתחילה — ואנחנו כאן כדי לטפל בזה.

אז מסכם את הפנייה:`

    const cleaned = sanitizeServiceDefectLiabilityReply(raw)
    assert.match(cleaned, /רואים בתמונה/)
    assert.doesNotMatch(cleaned, /מדובר בפגם/)
    assert.doesNotMatch(cleaned, /מלכתחילה/)
  })

  it("uses neutral defect label in rep report", () => {
    const report = buildServiceHandoffReportBlock(
      { issueKind: "defect" },
      "השטיח נפרם"
    )
    assert.match(report, /דיווח על בעיה/)
    assert.doesNotMatch(report, /^• פגם \/ בעיה במוצר/m)
  })

  it("validateHomAgentReply applies defect liability sanitizer", () => {
    const output = validateHomAgentReply(
      {
        reply:
          "רואים בתמונה חוט בקצה. מדובר בפגם שהגיע מלכתחילה — נטפל.",
        action: "reply",
      },
      "השטיח נפרם"
    )
    assert.match(output.reply, /רואים בתמונה/)
    assert.doesNotMatch(output.reply, /מדובר בפגם/)
  })

  it("exports stable defect report label constant", () => {
    assert.match(DEFECT_ISSUE_REPORT_LABEL, /לפי הלקוח/)
  })
})
