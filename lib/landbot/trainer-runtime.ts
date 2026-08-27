import {
  invalidateRuntimeConfigCache,
  saveRuntimeConfig,
  getRuntimeConfig,
  runtimeConfigSnapshot,
} from "@/lib/agent-core/runtime-config"
import type { ProfileName } from "@/lib/agent-core/model-profiles"

const PROFILE_COMMAND_RE = /^פרופיל\s+(quality|balanced|economy)\s*$/i
const STATUS_COMMAND_RE = /^סטטוס\s+מודלים\s*$/i

export function isTrainerProfileCommand(text: string) {
  return PROFILE_COMMAND_RE.test(text.trim()) || STATUS_COMMAND_RE.test(text.trim())
}

export async function handleTrainerProfileCommand(text: string) {
  const body = text.trim()

  if (STATUS_COMMAND_RE.test(body)) {
    const config = await getRuntimeConfig(true)
    const snap = runtimeConfigSnapshot(config)
    return `*הגדרות מודלים*
פרופיל: ${snap.activeProfile} (${snap.profileLabel})
Router: ${snap.models.router}
FAQ: ${snap.models.faq}
Sales: ${snap.models.sales}
Service: ${snap.models.service}
Debounce: ${snap.debounceMs}ms
History: ${snap.historyLimit} הודעות
Orchestra: ${snap.orchestraMode}
מקור: ${snap.source}`
  }

  const match = body.match(PROFILE_COMMAND_RE)
  if (!match?.[1]) return null

  const profile = match[1].toLowerCase() as ProfileName
  await saveRuntimeConfig({
    activeProfile: profile,
    updatedBy: "trainer_whatsapp",
  })
  invalidateRuntimeConfigCache()

  const config = await getRuntimeConfig(true)
  const snap = runtimeConfigSnapshot(config)
  return `פרופיל עודכן ל-*${profile}*.
Router: ${snap.models.router}
FAQ: ${snap.models.faq}
Sales: ${snap.models.sales}
Service: ${snap.models.service}`
}
