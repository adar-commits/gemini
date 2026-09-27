import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  countMessageInsightSignals,
  enrichDevelopmentInsights,
  QA_DEVELOPMENT_INSIGHTS,
} from "@/lib/agents/qa-development-insights"

describe("qa-development-insights", () => {
  it("counts RC and invoice patterns in user messages", () => {
    const signals = countMessageInsightSignals(
      [
        "שלום, RC1234567 זו הקבלה",
        "IN9876543",
        "הזמנה #89535",
        "SO26005938",
        "מתי מגיע?",
      ],
      7
    )
    assert.equal(signals.rcReceiptMentions, 1)
    assert.equal(signals.invoiceDocMentions, 1)
    assert.equal(signals.hashOrderMentions, 1)
    assert.equal(signals.soOrderMentions, 1)
    assert.equal(signals.userMessagesScanned, 5)
  })

  it("ranks critical API insight above low infra when signals tie", () => {
    const signals = countMessageInsightSignals([], 7)
    const ranked = enrichDevelopmentInsights(QA_DEVELOPMENT_INSIGHTS, signals, new Map())
    const critical = ranked.find((item) => item.id === "priority-api-document-lookup")
    const low = ranked.find((item) => item.id === "history-limit-tuning")
    assert.ok(critical)
    assert.ok(low)
    assert.ok(critical!.score > low!.score)
  })

  it("boosts score when QA themes mention insight id", () => {
    const signals = countMessageInsightSignals([], 7)
    const themes = new Map([["priority-api-document-lookup", 3]])
    const ranked = enrichDevelopmentInsights(QA_DEVELOPMENT_INSIGHTS, signals, themes)
    const insight = ranked.find((item) => item.id === "priority-api-document-lookup")
    assert.equal(insight?.qaFailureMentions, 3)
  })
})
