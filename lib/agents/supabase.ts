import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let agentClient: SupabaseClient | null = null

export function getAgentSupabase() {
  if (agentClient) return agentClient

  const url =
    process.env.AGENT_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey =
    process.env.AGENT_SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url?.trim() || !serviceKey?.trim()) {
    throw new Error(
      "Missing agent database credentials. Set AGENT_SUPABASE_URL and AGENT_SUPABASE_SERVICE_ROLE_KEY."
    )
  }

  agentClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return agentClient
}
