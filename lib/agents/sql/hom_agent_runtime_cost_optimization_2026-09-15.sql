-- Cost optimization deploy stamp: 2026-09-15T22:50:00+03:00 (Asia/Jerusalem)
-- Changes: history_limit 16→10, summary cadence 8→5 user turns (code), Opus escalation tightened (code)
update public.hom_agent_runtime_config
set
  history_limit = 10,
  updated_at = '2026-09-15T19:50:00Z'::timestamptz,
  updated_by = 'cost-optimization-2026-09-15'
where id = 'production';
