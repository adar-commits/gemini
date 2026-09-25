import { after } from "next/server"
import {
  executeCursorAutomationQa,
  type ExecuteCursorAutomationQaInput,
} from "@/lib/landbot/cursor-automation-qa"

async function runCursorAutomationQa(input: ExecuteCursorAutomationQaInput) {
  try {
    await executeCursorAutomationQa(input)
  } catch (error) {
    console.warn("[cursor-automation-qa] notify failed", {
      conversationId: input.conversationId,
      trigger: input.trigger,
      error: error instanceof Error ? error.message : error,
    })
  }
}

/**
 * Server-only — uses Next.js `after()` so Vercel finishes QA insert + webhook.
 * Outside a request scope (scripts, tests) `after()` throws, so run it directly.
 */
export function scheduleCursorAutomationQa(input: ExecuteCursorAutomationQaInput) {
  try {
    after(() => runCursorAutomationQa(input))
  } catch {
    void runCursorAutomationQa(input)
  }
}
