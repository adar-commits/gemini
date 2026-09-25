-- Operator notes typed on /dashboard/qa manual trigger; sent to the automation as payload.operator_notes.
-- Separate from operator_notes, which the automation's own logging overwrites.
alter table public.hom_agent_qa_runs
  add column if not exists operator_input text;
