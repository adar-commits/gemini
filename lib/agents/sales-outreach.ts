import type { HistoryMessage } from "@/lib/agents/types"

/** Rep-sent abandoned-cart WhatsApp template — already owned by sales outreach. */
export function isSalesOutreachTemplateMessage(content: string) {
  return /לא השלמת את הרכישה/u.test(content) && /שמי מאיר/u.test(content)
}

export function salesOutreachTemplateInThread(history: HistoryMessage[]) {
  for (const message of history) {
    if (message.role !== "assistant") continue
    if (isSalesOutreachTemplateMessage(message.content)) return true
  }
  return false
}
