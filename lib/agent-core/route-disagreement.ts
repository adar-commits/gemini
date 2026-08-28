import { getAgentSupabase } from "@/lib/agents/supabase"

export function logRouteDisagreement(input: {
  conversationId: string
  phone?: string | null
  body: string
  guessedRoute: string | null
  masterAction: string
}) {
  const agree =
    input.guessedRoute != null && input.guessedRoute === input.masterAction

  void (async () => {
    try {
      const supabase = getAgentSupabase()
      await supabase.from("hom_agent_route_disagreements").insert({
        conversation_id: input.conversationId,
        phone: input.phone?.trim() || null,
        body: input.body.slice(0, 2000),
        guessed_route: input.guessedRoute,
        master_action: input.masterAction,
        agree,
      })
    } catch {
      // non-blocking
    }
  })()
}
