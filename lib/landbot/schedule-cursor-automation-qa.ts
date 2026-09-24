import { after } from "next/server"
import {
  executeCursorAutomationQa,
  type ExecuteCursorAutomationQaInput,
} from "@/lib/landbot/cursor-automation-qa"

/** Server-only — uses Next.js `after()` so Vercel finishes QA insert + webhook. */
export function scheduleCursorAutomationQa(input: ExecuteCursorAutomationQaInput) {
  after(async () => {
    try {
      const result = await executeCursorAutomationQa(input)
      if ("skipped" in result) return
    } catch (error) {
      console.warn("[cursor-automation-qa] notify failed", {
        conversationId: input.conversationId,
        trigger: input.trigger,
        error: error instanceof Error ? error.message : error,
      })
    }
  })
}
