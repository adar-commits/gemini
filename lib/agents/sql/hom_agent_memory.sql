-- Applied to Landbot project walklyxhkhrdzbkfhtez
create table if not exists public.hom_agent_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  agent text not null,
  action text,
  created_at timestamptz not null default now()
);

create index if not exists hom_agent_messages_conversation_created_idx
  on public.hom_agent_messages (conversation_id, created_at desc);

create table if not exists public.hom_agent_sessions (
  conversation_id text primary key,
  reset_at timestamptz,
  last_agent text,
  updated_at timestamptz not null default now(),
  last_user_at timestamptz,
  last_assistant_at timestamptz,
  inactivity_ping_sent_at timestamptz,
  inactivity_closed_at timestamptz,
  customer_name text,
  customer_phone text
);

alter table public.hom_agent_messages enable row level security;
alter table public.hom_agent_sessions enable row level security;

revoke all on table public.hom_agent_messages from anon, authenticated, public;
revoke all on table public.hom_agent_sessions from anon, authenticated, public;

create table if not exists public.hom_agent_inbound (
  message_key text primary key,
  conversation_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists hom_agent_inbound_created_idx
  on public.hom_agent_inbound (created_at desc);

alter table public.hom_agent_inbound enable row level security;

revoke all on table public.hom_agent_inbound from anon, authenticated, public;

create table if not exists public.hom_agent_message_buffer (
  conversation_id text primary key,
  parts jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.hom_agent_message_buffer enable row level security;

revoke all on table public.hom_agent_message_buffer from anon, authenticated, public;

create table if not exists public.hom_agent_shadow_logs (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null,
  customer_id bigint,
  phone text,
  user_text text not null default '',
  agent text not null,
  action text,
  draft_reply text not null default '',
  replied boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists hom_agent_shadow_logs_created_idx
  on public.hom_agent_shadow_logs (created_at desc);

create index if not exists hom_agent_shadow_logs_phone_created_idx
  on public.hom_agent_shadow_logs (phone, created_at desc);

alter table public.hom_agent_shadow_logs enable row level security;

revoke all on table public.hom_agent_shadow_logs from anon, authenticated, public;

create table if not exists public.hom_agent_shadow_reviews (
  id uuid primary key default gen_random_uuid(),
  shadow_log_id uuid not null references public.hom_agent_shadow_logs(id) on delete cascade,
  verdict text not null check (verdict in ('ok', 'issue')),
  issue_types text[] not null default '{}',
  reason text not null default '',
  suggested_fix text not null default '',
  model text,
  reviewed_at timestamptz not null default now(),
  unique (shadow_log_id)
);

create index if not exists hom_agent_shadow_reviews_verdict_reviewed_idx
  on public.hom_agent_shadow_reviews (verdict, reviewed_at desc);

alter table public.hom_agent_shadow_reviews enable row level security;

revoke all on table public.hom_agent_shadow_reviews from anon, authenticated, public;

create table if not exists public.hom_agent_learned_rules (
  id uuid primary key default gen_random_uuid(),
  shadow_review_id uuid references public.hom_agent_shadow_reviews(id) on delete set null,
  rule_kind text not null check (
    rule_kind in ('route_regex', 'greeting_pattern', 'prompt_rule', 'off_topic_exception')
  ),
  agent text not null default 'all',
  pattern text,
  route_action text,
  rule_text text not null,
  source_user_text text,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now()
);

create index if not exists hom_agent_learned_rules_status_created_idx
  on public.hom_agent_learned_rules (status, created_at desc);

create unique index if not exists hom_agent_learned_rules_kind_pattern_uidx
  on public.hom_agent_learned_rules (rule_kind, pattern)
  where pattern is not null and status = 'active';

alter table public.hom_agent_learned_rules enable row level security;

revoke all on table public.hom_agent_learned_rules from anon, authenticated, public;
