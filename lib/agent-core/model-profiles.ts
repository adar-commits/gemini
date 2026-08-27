/** Code-default model profiles — overridden by Supabase runtime config. */

export type ProfileName = "quality" | "balanced" | "economy" | "custom"

export type RoleModelConfig = {
  model: string
  temperature: number
  maxOutputTokens: number
}

export type ModelProfile = {
  name: ProfileName
  label: string
  router: RoleModelConfig
  faq: RoleModelConfig
  sales: RoleModelConfig
  service: RoleModelConfig
}

const SONNET = "anthropic/claude-sonnet-4.6"
const OPUS = "anthropic/claude-opus-4.6"
const FLASH = "google/gemini-2.5-flash"
const FLASH_LITE = "google/gemini-2.5-flash-lite"

export const MODEL_PROFILES: Record<Exclude<ProfileName, "custom">, ModelProfile> = {
  quality: {
    name: "quality",
    label: "Maximum quality (Opus specialists)",
    router: { model: SONNET, temperature: 0.1, maxOutputTokens: 96 },
    faq: { model: OPUS, temperature: 0.18, maxOutputTokens: 800 },
    sales: { model: OPUS, temperature: 0.25, maxOutputTokens: 800 },
    service: { model: OPUS, temperature: 0.15, maxOutputTokens: 800 },
  },
  balanced: {
    name: "balanced",
    label: "Balanced (Flash router, Sonnet specialists)",
    router: { model: FLASH, temperature: 0.1, maxOutputTokens: 96 },
    faq: { model: SONNET, temperature: 0.18, maxOutputTokens: 700 },
    sales: { model: SONNET, temperature: 0.25, maxOutputTokens: 700 },
    service: { model: SONNET, temperature: 0.15, maxOutputTokens: 700 },
  },
  economy: {
    name: "economy",
    label: "Economy (Flash / Flash Lite)",
    router: { model: FLASH_LITE, temperature: 0.1, maxOutputTokens: 64 },
    faq: { model: FLASH, temperature: 0.2, maxOutputTokens: 600 },
    sales: { model: FLASH, temperature: 0.25, maxOutputTokens: 600 },
    service: { model: SONNET, temperature: 0.15, maxOutputTokens: 600 },
  },
}

export const DEFAULT_PROFILE_NAME: Exclude<ProfileName, "custom"> = "balanced"

export function profileByName(name: string): ModelProfile {
  if (name === "custom") {
    return { ...MODEL_PROFILES.balanced, name: "custom", label: "Custom (Supabase)" }
  }
  if (name in MODEL_PROFILES) {
    return MODEL_PROFILES[name as Exclude<ProfileName, "custom">]
  }
  return MODEL_PROFILES[DEFAULT_PROFILE_NAME]
}
