-- Operator answers to a waiting QA event (ask_operator / too_risky / unconfirmed real_failure), oldest first.
alter table public.hom_agent_qa_runs
  add column if not exists operator_replies jsonb not null default '[]'::jsonb;
