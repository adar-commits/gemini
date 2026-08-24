import { CUSTOMER_HEADER } from "@/lib/agents/types"

/** Customer wrote only "שירות לקוחות" (or similar) with no case details yet. */
export function isCustomerServiceOpener(body: string) {
  const text = body.trim()
  if (!text) return false
  return (
    /^שירות\s+לקוחות[\s!?.,]*$/i.test(text) ||
    /^נציג(?:\s+שירות)?(?:\s+לקוחות)?[\s!?.,]*$/i.test(text)
  )
}

export function buildCustomerServiceTopicPrompt() {
  return `${CUSTOMER_HEADER}\nכיצד אוכל לעזור?\nיש לפרט את נושא הפנייה`
}
