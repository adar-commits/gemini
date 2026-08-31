import { jsonSchema, Output } from "ai"

export const HOM_AGENT_ACTIONS = [
  "reply",
  "human_sales",
  "human_service",
  "reset",
  "end",
] as const

export type HomAgentAction = (typeof HOM_AGENT_ACTIONS)[number]

export type HomAgentOutput = {
  reply: string
  action: HomAgentAction
}

export function homAgentOutputSchema() {
  return Output.object({
    name: "hom_agent_turn",
    description:
      "Customer-facing Hebrew reply and Landbot action. reply must never be empty on substantive turns.",
    schema: jsonSchema<HomAgentOutput>({
      type: "object",
      additionalProperties: false,
      required: ["reply", "action"],
      properties: {
        reply: {
          type: "string",
          description: "Full Hebrew message for the customer",
        },
        action: {
          type: "string",
          enum: [...HOM_AGENT_ACTIONS],
        },
      },
    }),
  })
}

export function normalizeHomAgentAction(value: string): HomAgentAction {
  if ((HOM_AGENT_ACTIONS as readonly string[]).includes(value)) {
    return value as HomAgentAction
  }
  return "reply"
}
