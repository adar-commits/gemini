/**
 * Sticky last-human on reopen — Landbot owns assign/reassign (separate repo/PR).
 *
 * Gemini cooperates by:
 * - Staying silent while `isHumanThreadActive` (assigned human or recent human activity).
 * - Releasing stale takeover via `releaseHumanThread` when customer confirms bot handoff.
 * - Never looping "לא הצלחתי להבין" on substantive reopen messages once the thread
 *   returns to the API bot (Landbot cleared assign / reassigned to bot).
 *
 * Landbot should on customer reopen after a human handler:
 * 1. Reassign to last meaningful human agent (sticky forever — product decision).
 * 2. OR call `POST /api/landbot/release-human-thread` with conversationId when intentionally
 *    returning the thread to HoM bot only.
 *
 * Webhook entry: same Landbot inbound hook; assign state comes from Landbot `assignedAgentId`.
 */

export const STICKY_HUMAN_REOPEN_LANDBOT_NOTE = `
Landbot sticky reopen (forever): when customer writes again after a human handled the thread,
reassign to that agent in Landbot. Gemini stays silent only while human assignment/activity
flags are active — do not rely on bot silence as a substitute for sticky assign.
`.trim()
