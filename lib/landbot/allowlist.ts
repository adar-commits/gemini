import { allowAllCustomerPhones, isCustomerPhoneAllowed, trainerPhones } from "@/lib/landbot/trainer"

/**
 * Inbound gate: `LANDBOT_TRAINER_PHONES=*` opens all customers; otherwise trainer list only.
 */
export function shouldProcessPhone(phone: string | null | undefined) {
  return isCustomerPhoneAllowed(phone)
}

export function shouldReplyPhone(phone: string | null | undefined) {
  return isCustomerPhoneAllowed(phone)
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
  const allCustomers = allowAllCustomerPhones()
  return {
    mode: allCustomers ? ("all_customers" as const) : ("trainer_only" as const),
    env: "LANDBOT_TRAINER_PHONES",
    trainers,
    process: allCustomers ? ["*"] : trainers,
    reply: allCustomers ? ["*"] : trainers,
    note: allCustomers
      ? "LANDBOT_TRAINER_PHONES=* — all WhatsApp customers run AI and get replies."
      : "Set LANDBOT_TRAINER_PHONES (comma-separated) or * for all customers.",
  }
}
