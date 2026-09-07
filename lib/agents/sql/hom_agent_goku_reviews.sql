-- GOKU trainer — Fable-powered post-conversation reviewer.
-- One review per conversation ending (reviewed_up_to = last message timestamp,
-- so a conversation that resumes and ends again gets a fresh review).
create table if not exists public.hom_agent_goku_reviews (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null,
  reviewed_up_to timestamptz not null,
  trigger text not null,              -- inactivity_close | handoff | end
  verdict text not null,              -- ok | issue
  grade int,                          -- 1-10 receptionist quality
  summary text,                       -- Hebrew feedback for the operator
  issues jsonb,
  proposed_rules jsonb,
  kb_gaps jsonb,
  rules_inserted int not null default 0,
  model text,
  created_at timestamptz not null default now(),
  unique (conversation_id, reviewed_up_to)
);

create index if not exists hom_agent_goku_reviews_created_idx
  on public.hom_agent_goku_reviews (created_at desc);

alter table public.hom_agent_goku_reviews enable row level security;
revoke all on table public.hom_agent_goku_reviews from anon, authenticated, public;
