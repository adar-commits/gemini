import { jsonSchema, Output } from "ai"

export const HOM_AGENT_ACTIONS = [
  "reply",
  "human_sales",
  "human_service",
  "reset",
  "end",
] as const

export type HomAgentAction = (typeof HOM_AGENT_ACTIONS)[number]

export const CRM_DEPARTMENT_SLUGS = ["sales", "service"] as const

export type CrmDepartmentSlug = (typeof CRM_DEPARTMENT_SLUGS)[number]

export type HomAgentOutput = {
  reply: string
  action: HomAgentAction
  /** Internal CRM inbox tag — omit when department is not 100% certain. */
  crm_department?: CrmDepartmentSlug
  /** False when reply ends with an optional follow-up offer — silence is OK. */
  expects_reply?: boolean
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
          description:
            "Use reply for almost all turns. Never use end for thanks (תודה). end is rare — inactivity only.",
        },
        crm_department: {
          type: "string",
          enum: [...CRM_DEPARTMENT_SLUGS],
          description:
            "Optional CRM inbox department when 100% certain: sales (מכירות) or service (שירות לקוחות). Omit on greetings, bare נציג, or ambiguous FAQ.",
        },
        expects_reply: {
          type: "boolean",
          description:
            "Default true. Set false when the reply ends with a warm resolution close (e.g. שמחתי לעזור היום! 😊) — customer silence means the thread is naturally done; never chase with עדיין כאן? or ask another follow-up question.",
        },
      },
    }),
  })
}

export function normalizeHomAgentCrmDepartment(
  value: unknown
): CrmDepartmentSlug | undefined {
  if (value === "sales" || value === "service") return value
  return undefined
}

export function normalizeHomAgentAction(value: string): HomAgentAction {
  if ((HOM_AGENT_ACTIONS as readonly string[]).includes(value)) {
    return value as HomAgentAction
  }
  return "reply"
}
