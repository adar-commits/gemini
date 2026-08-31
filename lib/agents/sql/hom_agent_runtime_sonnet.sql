-- Switch production to Sonnet (balanced) and cap history at 18 messages.
update public.hom_agent_runtime_config
set
  active_profile = 'balanced',
  history_limit = 18,
  profile_json = '{
    "router": {"model": "anthropic/claude-sonnet-4.6", "temperature": 0.1, "maxOutputTokens": 96},
    "faq": {"model": "anthropic/claude-sonnet-4.6", "temperature": 0.18, "maxOutputTokens": 700},
    "sales": {"model": "anthropic/claude-sonnet-4.6", "temperature": 0.25, "maxOutputTokens": 700},
    "service": {"model": "anthropic/claude-sonnet-4.6", "temperature": 0.15, "maxOutputTokens": 700}
  }'::jsonb,
  updated_at = now(),
  updated_by = 'agent-config-sonnet'
where id = 'production';
