-- GOKU_TRAINER: post-conversation QA reports and retraining suggestions.
-- Apply on the Landbot agent Supabase project (AGENT_SUPABASE_URL).

create table if not exists public.hom_agent_goku_reports (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null unique,
  close_reason text not null check (
    close_reason in ('inactivity_close', 'reset', 'end', 'stale_expire')
  ),
  summary text not null default '',
  grade smallint not null check (grade >= 1 and grade <= 10),
  analysis jsonb not null default '{}'::jsonb,
  suggestions jsonb not null default '[]'::jsonb,
  applied_rule_ids uuid[] not null default '{}',
  model text,
  created_at timestamptz not null default now()
);

create index if not exists hom_agent_goku_reports_created_idx
  on public.hom_agent_goku_reports (created_at desc);

create index if not exists hom_agent_goku_reports_grade_idx
  on public.hom_agent_goku_reports (grade, created_at desc);

alter table public.hom_agent_goku_reports enable row level security;

revoke all on table public.hom_agent_goku_reports from anon, authenticated, public;

-- Optional traceability on learned rules (safe if column already exists).
alter table public.hom_agent_learned_rules
  add column if not exists source text;

alter table public.hom_agent_learned_rules
  add column if not exists goku_report_id uuid references public.hom_agent_goku_reports(id) on delete set null;

create index if not exists hom_agent_learned_rules_goku_report_idx
  on public.hom_agent_learned_rules (goku_report_id)
  where goku_report_id is not null;

-- Expand rule_kind check to match runtime (fast_reply, reply_guard).
alter table public.hom_agent_learned_rules
  drop constraint if exists hom_agent_learned_rules_rule_kind_check;

alter table public.hom_agent_learned_rules
  add constraint hom_agent_learned_rules_rule_kind_check check (
    rule_kind in (
      'route_regex',
      'greeting_pattern',
      'prompt_rule',
      'off_topic_exception',
      'fast_reply',
      'reply_guard'
    )
  );
