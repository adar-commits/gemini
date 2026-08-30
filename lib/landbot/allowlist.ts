import { isTrainerPhone, trainerPhones } from "@/lib/landbot/trainer"

/**
 * Trainer-only gate: only configured trainer phones run the agent or receive replies.
 * LANDBOT_PROCESS_PHONES / LANDBOT_REPLY_PHONES are intentionally ignored so a stray
 * `*` in Vercel cannot silently burn tokens on real customer traffic.
 *
 * Configure trainers via LANDBOT_TRAINER_PHONE or LANDBOT_TRAINER_PHONES.
 */
export function shouldProcessPhone(phone: string | null | undefined) {
  return isTrainerPhone(phone)
}

/** Same as shouldProcessPhone — trainers get replies; everyone else is skipped. */
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
    trainers,
    process: trainers,
    reply: trainers,
    note:
      "Only trainer phones run AI and receive WhatsApp replies. Set LANDBOT_TRAINER_PHONE or LANDBOT_TRAINER_PHONES.",
  }
}
