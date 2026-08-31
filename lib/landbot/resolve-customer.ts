import { getAgentSupabase } from "@/lib/agents/supabase"
import { trainerPhone } from "@/lib/landbot/trainer"

function digits(phone: string) {
  let value = phone.replace(/\D/g, "")
  if (value.startsWith("00")) value = value.slice(2)
  return value
}

function phoneVariants(phone: string) {
  const raw = digits(phone)
  const set = new Set<string>([raw, phone.trim()])
  if (raw.startsWith("0") && raw.length >= 9) {
    set.add(`972${raw.slice(1)}`)
    set.add(`+972${raw.slice(1)}`)
  }
  if (raw.startsWith("972") && raw.length >= 11) {
    set.add(`0${raw.slice(3)}`)
    set.add(`+${raw}`)
  }
  if (raw.length === 9 && raw.startsWith("5")) {
    set.add(`972${raw}`)
    set.add(`+972${raw}`)
    set.add(`0${raw}`)
  }
  return Array.from(set).filter(Boolean)
}

export async function resolveCustomerIdByPhone(phone: string) {
  const variants = phoneVariants(phone)
  const supabase = getAgentSupabase()

  for (const variant of variants) {
    const e164 = variant.startsWith("+") ? variant : variant.startsWith("972") ? `+${variant}` : variant
    const { data } = await supabase
      .from("conversations")
      .select("landbot_customer_id")
      .or(`phone_e164.eq.${e164},phone_raw.eq.${variant},phone_e164.eq.${variant}`)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    const id = Number(data?.landbot_customer_id)
    if (Number.isFinite(id) && id > 0) return id
  }

  return null
}

export async function resetAgentSession(conversationId: string) {
  const supabase = getAgentSupabase()
  await supabase.from("hom_agent_messages").delete().eq("conversation_id", conversationId)
  // Keep buffered customer turns and the active processor lease — reset must not drop pending messages.
  await supabase
    .from("hom_agent_inbound")
    .delete()
    .eq("conversation_id", conversationId)
    .neq("message_key", `processor:${conversationId}`)
  await supabase.from("hom_agent_sessions").upsert({
    conversation_id: conversationId,
    reset_at: new Date().toISOString(),
    last_agent: "master",
    updated_at: new Date().toISOString(),
    inactivity_ping_sent_at: null,
    inactivity_closed_at: null,
  })
}

export async function resolveTrainerCustomerId(phone = trainerPhone()) {
  return resolveCustomerIdByPhone(phone)
}
