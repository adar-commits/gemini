import { getAgentSupabase } from "@/lib/agents/supabase"
import type { AddressFixerOutput } from "./index"

/** Best-effort request log. Never throws; disabled with ADDRESS_FIXER_LOG=0. */
export async function logAddressFix(output: AddressFixerOutput): Promise<void> {
  if (process.env.ADDRESS_FIXER_LOG?.trim() === "0") return
  try {
    await getAgentSupabase()
      .from("address_fixer_logs")
      .insert({
        input_city: output.original.city.slice(0, 200),
        input_street: output.original.full_street.slice(0, 500),
        input_units: output.original.apartment_floor.slice(0, 300),
        output_city: output.city,
        output_street: output.street,
        output_street_no: output.street_no,
        output_floor: output.floor,
        output_apartment: output.apartment,
        output_entrance: output.entrance,
        city_matched: output.city_matched,
        street_matched: output.street_matched,
        confidence: output.confidence,
        match_tier: output.match_tier,
        notes: output.notes,
      })
  } catch {
    // Logging must never affect the response.
  }
}
