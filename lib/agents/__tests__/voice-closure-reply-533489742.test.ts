import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  shouldBypassHumanThreadSilence,
  shouldClearHumanThreadOnBypass,
} from "@/lib/agents/off-topic"
import { VOICE_CLOSURE_TEMPLATE_BODY } from "@/lib/landbot/voice-closure-template"
import { isVoiceClosureTemplateInHistory } from "@/lib/landbot/voice-closure-reply"

// 533489742: after human_service handoff the dashboard kept resending the voice-closure
// template on every customer reply because the bot stayed silent (human_thread_active).
// Customer: "אתם חוזרים על עצמכם קצת מתחיל לעצבן" — no bot answer, only repeated template.
describe("voice closure reply bypasses human thread silence (533489742)", () => {
  const postHandoffHistory: HistoryMessage[] = [
    {
      role: "assistant",
      content:
        "כן. כשהביטול מתבצע, הזיכוי חוזר לאמצעי התשלום שבו שילמת, עד 7 ימי עסקים.\n\nאני מעביר עכשיו את בקשת הביטול לנציג שירות, והוא ימשיך איתך מכאן.",
      action: "human_service",
    },
    { role: "user", content: "בבקשה להתקשר אליי" },
    { role: "assistant", content: VOICE_CLOSURE_TEMPLATE_BODY },
  ]

  it("detects voice-closure template as last assistant", () => {
    assert.equal(isVoiceClosureTemplateInHistory(postHandoffHistory), true)
  })

  it("bypasses human thread silence for any customer reply after the template", () => {
    assert.equal(
      shouldBypassHumanThreadSilence("איך אני מקבל את הכסף חזרה", postHandoffHistory),
      true
    )
    assert.equal(
      shouldBypassHumanThreadSilence("אתם חוזרים על עצמכם קצת מתחיל לעצבן", postHandoffHistory),
      true
    )
  })

  it("releases stale human takeover so the bot can answer", () => {
    assert.equal(
      shouldClearHumanThreadOnBypass("רוצה לבטל הזמנה עכשו", postHandoffHistory),
      true
    )
  })

  it("does not bypass when a live rep spoke last instead of the template", () => {
    const repSpokeLast: HistoryMessage[] = [
      { role: "assistant", content: VOICE_CLOSURE_TEMPLATE_BODY },
      { role: "user", content: "היי" },
      { role: "assistant", content: "היי פרץ, מצטער על העיכוב — אביגיל" },
    ]

    assert.equal(isVoiceClosureTemplateInHistory(repSpokeLast), false)
    assert.equal(shouldBypassHumanThreadSilence("תודה", repSpokeLast), false)
  })
})
