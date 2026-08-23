const DEFAULT_TRAINER_PHONE = "+972547495083"

export function trainerPhone() {
  return (
    process.env.LANDBOT_TRAINER_PHONE?.trim() ||
    process.env.LANDBOT_REPLY_PHONES?.trim()?.split(/[,\s]+/)[0] ||
    DEFAULT_TRAINER_PHONE
  )
}
