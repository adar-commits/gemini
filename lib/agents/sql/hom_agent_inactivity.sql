-- Inactivity ping (60s) + close (120s) on hom_agent_sessions.
alter table public.hom_agent_sessions
  add column if not exists last_user_at timestamptz,
  add column if not exists last_assistant_at timestamptz,
  add column if not exists inactivity_ping_sent_at timestamptz,
  add column if not exists inactivity_closed_at timestamptz,
  add column if not exists customer_name text,
  add column if not exists customer_phone text;

create index if not exists hom_agent_sessions_inactivity_idx
  on public.hom_agent_sessions (last_assistant_at desc)
  where inactivity_closed_at is null;
