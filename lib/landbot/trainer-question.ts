import { generateText } from "ai"
import { getConversationContext } from "@/lib/agents/memory"

const TRAINER_CHAT_SYSTEM = `
You are the internal AI assistant behind the HoM GROUP WhatsApp bot (הום בוט).
The person messaging is a TRAINER or operator testing or improving the bot — NOT a customer.

Rules:
- Answer directly, honestly, and technically about the bot, its behavior, limits, and recent conversation context.
- Do NOT role-play as the customer-facing bot. Do NOT start sales intake or FAQ flows.
- Do NOT use the *הום בוט :)* header or pretend this is a client conversation.
- If asked why the bot replied a certain way, explain using the conversation history provided.
- Reply in clear Hebrew unless the trainer writes in English.
- Be concise — this is WhatsApp.
`.trim()

function trainerQuestionModel() {
  return (
    process.env.TRAINER_QUESTION_MODEL?.trim() ||
    process.env.AGENT_ROUTER_MODEL?.trim() ||
    "google/gemini-2.5-flash-lite"
  )
}

export const TRAINER_QUESTION_EMPTY_HINT =
  "כתוב את השאלה אחרי המילה שאלה: — למשל: שאלה: למה שאלת על הסלון במקום על החלל?"

export async function answerTrainerQuestion(input: {
  question: string
  conversationId: string
}) {
  const { history } = await getConversationContext(input.conversationId)
  const recent = history.slice(-10)

  const result = await generateText({
    model: trainerQuestionModel(),
    system: TRAINER_CHAT_SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          "Recent simulated customer conversation (for context):",
          recent.length
            ? recent.map((m) => `${m.role}: ${m.content}`).join("\n")
            : "(empty)",
          "",
          `Trainer question: ${input.question}`,
        ].join("\n"),
      },
    ],
    maxOutputTokens: 800,
  })

  return result.text.trim() || "לא הצלחתי לנסח תשובה. נסה לנסח מחדש."
}
