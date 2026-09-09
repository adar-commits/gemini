-- Optional seed: reinforce masculine bot voice in TRAINER RULES section.
-- Safe to run multiple times (disables older duplicate before insert).

update public.hom_agent_learned_rules
set status = 'disabled'
where rule_kind = 'prompt_rule'
  and status = 'active'
  and rule_text like 'הום בוט — masculine self-reference%';

insert into public.hom_agent_learned_rules (
  rule_kind,
  agent,
  rule_text,
  source_user_text,
  status
) values (
  'prompt_rule',
  'all',
  'הום בוט — masculine self-reference only (אני שמח, מוכן, מכוון). Never feminine on yourself (מוכנה, מכוונת, שמחה). Feminine for orders/products (ההזמנה מוכנה) stays as-is.',
  'owner:bot-voice-card',
  'active'
);
