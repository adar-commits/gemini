-- Runtime model profiles (no Vercel env churn for A/B)
create table if not exists public.hom_agent_runtime_config (
  id text primary key default 'production',
  active_profile text not null default 'balanced',
  profile_json jsonb not null default '{}'::jsonb,
  routing_mode text not null default 'llm',
  debounce_ms int not null default 2000,
  history_limit int not null default 18,
  orchestra_mode text not null default 'off',
  updated_at timestamptz not null default now(),
  updated_by text
);

insert into public.hom_agent_runtime_config (id, active_profile, profile_json, routing_mode, debounce_ms, history_limit, orchestra_mode, updated_by)
values (
  'production',
  'balanced',
  '{
    "router": {"model": "google/gemini-2.5-flash", "temperature": 0.1, "maxOutputTokens": 96},
    "faq": {"model": "anthropic/claude-sonnet-4.6", "temperature": 0.18, "maxOutputTokens": 700},
    "sales": {"model": "anthropic/claude-sonnet-4.6", "temperature": 0.25, "maxOutputTokens": 700},
    "service": {"model": "anthropic/claude-sonnet-4.6", "temperature": 0.15, "maxOutputTokens": 700}
  }'::jsonb,
  'llm',
  2000,
  18,
  'off',
  'migration'
)
on conflict (id) do nothing;

alter table public.hom_agent_runtime_config enable row level security;
revoke all on table public.hom_agent_runtime_config from anon, authenticated, public;

-- Session rolling summary for long threads
alter table public.hom_agent_sessions
  add column if not exists conversation_summary text;

-- Optional turn metrics on shadow logs
alter table public.hom_agent_shadow_logs
  add column if not exists latency_ms int,
  add column if not exists llm_calls int,
  add column if not exists models_used jsonb,
  add column if not exists tier text,
  add column if not exists profile text,
  add column if not exists fallback_layer text;
