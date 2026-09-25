-- What the bot is waiting for after an assistant message (order confirm, phone confirm, handoff confirm…).
-- Pending-state detectors read this instead of regex-matching the bot's own wording.
alter table public.hom_agent_messages
  add column if not exists awaiting text;
