-- Token usage per LLM call (Landbot Supabase walklyxhkhrdzbkfhtez)
create table if not exists public.hom_agent_token_usage (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null,
  phone text,
  purpose text not null,
  agent text,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  tier text,
  routing_path text,
  profile text,
  created_at timestamptz not null default now()
);

create index if not exists hom_agent_token_usage_conversation_created_idx
  on public.hom_agent_token_usage (conversation_id, created_at desc);

create index if not exists hom_agent_token_usage_created_idx
  on public.hom_agent_token_usage (created_at desc);

alter table public.hom_agent_token_usage enable row level security;
revoke all on table public.hom_agent_token_usage from anon, authenticated, public;

-- Per-turn token totals on shadow logs
alter table public.hom_agent_shadow_logs
  add column if not exists input_tokens int,
  add column if not exists output_tokens int,
  add column if not exists routing_path text;

-- History limit default for new installs
alter table public.hom_agent_runtime_config
  alter column history_limit set default 18;

update public.hom_agent_runtime_config
set history_limit = 18
where id = 'production' and history_limit = 40;
