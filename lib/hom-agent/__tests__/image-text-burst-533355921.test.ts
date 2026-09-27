import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { lastCustomerTurnIncludedImage } from "@/lib/hom-agent/truncated-output"
import { repairTruncatedBotReply } from "@/lib/hom-agent/truncated-output"
import { turnAwaitingTextAfterMedia } from "@/lib/landbot/message-buffer"
import type { HistoryMessage } from "@/lib/agents/types"

/** 533355921 — image burst + caption must not get completion-tail truncation. */
describe("image + text burst (533355921)", () => {
  it("soaks image-only turns awaiting caption text", () => {
    assert.equal(
      turnAwaitingTextAfterMedia({
        text: "",
        media: [{ kind: "image", url: "https://example.com/rug.jpg" }],
      }),
      true
    )
  })

  it("skips completion-tail repair when last customer turn had an image", () => {
    const history: HistoryMessage[] = [
      {
        role: "user",
        content: "[media:image:https://example.com/rug.jpg]\nשלא יהיה עבה מדי",
      },
    ]
    assert.equal(lastCustomerTurnIncludedImage(history), true)

    const partial =
      "מבין — מחפשים שטיח שלא יהיה עבה מדי לחדר. יש כמה אפשרויות מתאימות"
    const withTail = repairTruncatedBotReply(partial)
    assert.match(withTail, /נקטעה|נראה/)
    const withoutTail = repairTruncatedBotReply(partial, { skipCompletionTail: true })
    assert.doesNotMatch(withoutTail, /נקטעה|נראה/)
  })
})
