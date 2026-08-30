import { isTrainerPhone, trainerPhones } from "@/lib/landbot/trainer"

/**
 * Trainer-only gate: only `LANDBOT_TRAINER_PHONES` run the agent, receive replies,
 * and call Priority/n8n. All other inbound WhatsApp messages are skipped.
 */
export function shouldProcessPhone(phone: string | null | undefined) {
  return isTrainerPhone(phone)
}

export function shouldReplyPhone(phone: string | null | undefined) {
  return isTrainerPhone(phone)
}

/** @deprecated Use trainerPhones() from @/lib/landbot/trainer */
export function allowlistPhones() {
  return trainerPhones()
}

/** @deprecated Use shouldProcessPhone() */
export function isPhoneAllowed(phone: string | null | undefined) {
  return shouldProcessPhone(phone)
}

export function landbotPhonePolicy() {
  const trainers = trainerPhones()
  return {
    mode: "trainer_only" as const,
    env: "LANDBOT_TRAINER_PHONES",
    trainers,
    process: trainers,
    reply: trainers,
    note: "Set LANDBOT_TRAINER_PHONES (comma-separated). Only those numbers run AI and get replies.",
  }
}
