-- Bulk deterministic shadow review drain for Landbot Supabase (walklyxhkhrdzbkfhtez).
-- Mirrors lib/landbot/shadow-deterministic.ts — run via Supabase SQL or production cron.

-- Pass 1: clear issues
INSERT INTO hom_agent_shadow_reviews (shadow_log_id, verdict, issue_types, reason, suggested_fix, model)
SELECT l.id, 'issue', ARRAY['empty_reply','wrong_action']::text[],
  'פעולת shipping ללא תשובה ללקוח.',
  'route-intent + shipping reply template', 'deterministic'
FROM hom_agent_shadow_logs l
LEFT JOIN hom_agent_shadow_reviews r ON r.shadow_log_id = l.id
WHERE r.id IS NULL
  AND l.action IN ('shipping', 'ROUTE_TO_SHIPPING_STATUS')
  AND COALESCE(trim(l.draft_reply), '') = '';

INSERT INTO hom_agent_shadow_reviews (shadow_log_id, verdict, issue_types, reason, suggested_fix, model)
SELECT l.id, 'issue', ARRAY['tone']::text[],
  'כותרת *הום בוט :)* כפולה בתשובה.',
  'normalizeReply — dedupe header', 'deterministic'
FROM hom_agent_shadow_logs l
LEFT JOIN hom_agent_shadow_reviews r ON r.shadow_log_id = l.id
WHERE r.id IS NULL
  AND trim(l.draft_reply) ~ '^\*הום בוט :\)\*\s*\*הום בוט';

INSERT INTO hom_agent_shadow_reviews (shadow_log_id, verdict, issue_types, reason, suggested_fix, model)
SELECT l.id, 'issue', ARRAY['wrong_action','empty_reply']::text[],
  'שירות לקוחות הופנה ל-shipping במקום בקשת נושא.',
  'customer-service-opener → topic prompt', 'deterministic'
FROM hom_agent_shadow_logs l
LEFT JOIN hom_agent_shadow_reviews r ON r.shadow_log_id = l.id
WHERE r.id IS NULL
  AND trim(l.user_text) ~* '^(שירות\s+לקוחות|נציג(?:\s+שירות)?(?:\s+לקוחות)?)[\s!?.,]*$'
  AND l.action IN ('shipping', 'ROUTE_TO_SHIPPING_STATUS');

INSERT INTO hom_agent_shadow_reviews (shadow_log_id, verdict, issue_types, reason, suggested_fix, model)
SELECT l.id, 'issue', ARRAY['route_wrong','wrong_action']::text[],
  'תלונה/זיכוי/התאמת מחיר — הופנה לשאלון מכירות.',
  'break sales sticky on isServiceTopicSwitch', 'deterministic'
FROM hom_agent_shadow_logs l
LEFT JOIN hom_agent_shadow_reviews r ON r.shadow_log_id = l.id
WHERE r.id IS NULL
  AND l.agent = 'sales'
  AND l.draft_reply ~* 'לאיזה\s+חלל|יש\s+בעלי\s+חיים|שטיח\s+מיועד|תקציב\s+שחשבת'
  AND trim(l.user_text) ~* 'קרוע|פגום|לא\s+קיבלתי|לא\s+עונים|התאמת\s+מחיר|זיכוי|לגבי\s+הזיכוי|מקווה\s+שנסגור|תלונה|טעות\s+ב(?:ה)?זמנה';

INSERT INTO hom_agent_shadow_reviews (shadow_log_id, verdict, issue_types, reason, suggested_fix, model)
SELECT l.id, 'issue', ARRAY['route_wrong']::text[],
  'אי-שביעות רצון ללא פגם — הופנה למכירות במקום FAQ החזרה.',
  'isDissatisfactionWithoutDefect → FAQ rescue', 'deterministic'
FROM hom_agent_shadow_logs l
LEFT JOIN hom_agent_shadow_reviews r ON r.shadow_log_id = l.id
WHERE r.id IS NULL
  AND l.agent = 'sales'
  AND trim(l.user_text) ~* 'לא\s+מרוצ|לא\s+מתאים|לא\s+אהב'
  AND trim(l.user_text) !~* 'קרוע|פגום|לא\s+קיבלתי|חסר';

INSERT INTO hom_agent_shadow_reviews (shadow_log_id, verdict, issue_types, reason, suggested_fix, model)
SELECT l.id, 'issue', ARRAY['handoff_early']::text[],
  'סגירת שיחה או סימן שאלה — לא להעביר לנציג.',
  'isConversationClosing / isNonSubstantiveFollowUp → end or ack', 'deterministic'
FROM hom_agent_shadow_logs l
LEFT JOIN hom_agent_shadow_reviews r ON r.shadow_log_id = l.id
WHERE r.id IS NULL
  AND l.action IN ('human_service', 'human_sales')
  AND (
    trim(l.user_text) ~* '^(תודה(?:\s+רבה)?|לא,?\s*תודה|זה\s+הכל|יום\s+טוב|ביי|להתראות|סבבה\s+תודה|בסדר\s+תודה|מעולה\s+תודה|יופי\s+תודה|הסתדר(?:תי|נו))'
    OR trim(l.user_text) ~ '^[?!.,\s🙏👍]+$'
  );

INSERT INTO hom_agent_shadow_reviews (shadow_log_id, verdict, issue_types, reason, suggested_fix, model)
SELECT l.id, 'issue', ARRAY['policy_risk','kb_missing']::text[],
  'שאלת מוצר/מלאי — FAQ המציא זמינות או מחיר.',
  'product handoff — no fake stock', 'deterministic'
FROM hom_agent_shadow_logs l
LEFT JOIN hom_agent_shadow_reviews r ON r.shadow_log_id = l.id
WHERE r.id IS NULL
  AND l.agent = 'faq'
  AND l.draft_reply ~* 'אבדוק|בודק(?:ים)?\s+.*מלאי|זמין\s+במלאי|קיים\s+במלאי'
  AND trim(l.user_text) ~* 'פרטים\s+נוספים|במלאי|מחיר|דגם|יש\s+ל(?:כם|נו)';

INSERT INTO hom_agent_shadow_reviews (shadow_log_id, verdict, issue_types, reason, suggested_fix, model)
SELECT l.id, 'issue', ARRAY['wrong_action','tone']::text[],
  'שאלה אסורה: "למי הסלון משמש".',
  'sales intake — space first, no household for salon', 'deterministic'
FROM hom_agent_shadow_logs l
LEFT JOIN hom_agent_shadow_reviews r ON r.shadow_log_id = l.id
WHERE r.id IS NULL
  AND l.draft_reply ~* 'למי\s+הסלון\s+משמש';

INSERT INTO hom_agent_shadow_reviews (shadow_log_id, verdict, issue_types, reason, suggested_fix, model)
SELECT l.id, 'issue', ARRAY['empty_reply']::text[],
  'handoff לנציג ללא הודעה ללקוח.',
  'handoff confirmation line required', 'deterministic'
FROM hom_agent_shadow_logs l
LEFT JOIN hom_agent_shadow_reviews r ON r.shadow_log_id = l.id
WHERE r.id IS NULL
  AND l.action IN ('human_service', 'human_sales')
  AND COALESCE(trim(l.draft_reply), '') = '';

-- Pass 2: clear OK
INSERT INTO hom_agent_shadow_reviews (shadow_log_id, verdict, issue_types, reason, suggested_fix, model)
SELECT l.id, 'ok', ARRAY[]::text[],
  'שירות לקוחות — בקשת נושא הפנייה (תקין).', 'none', 'deterministic'
FROM hom_agent_shadow_logs l
LEFT JOIN hom_agent_shadow_reviews r ON r.shadow_log_id = l.id
WHERE r.id IS NULL
  AND trim(l.user_text) ~* '^(שירות\s+לקוחות|נציג(?:\s+שירות)?(?:\s+לקוחות)?)[\s!?.,]*$'
  AND l.draft_reply ~* 'כיצד\s+א(?:וכ|ו)ל\s+לעזור|נושא\s+הפנייה';

INSERT INTO hom_agent_shadow_reviews (shadow_log_id, verdict, issue_types, reason, suggested_fix, model)
SELECT l.id, 'ok', ARRAY[]::text[],
  'שאלת משלוח — תשובה לא ריקה (תקין).', 'none', 'deterministic'
FROM hom_agent_shadow_logs l
LEFT JOIN hom_agent_shadow_reviews r ON r.shadow_log_id = l.id
WHERE r.id IS NULL
  AND COALESCE(trim(l.draft_reply), '') <> ''
  AND l.action = 'shipping';

INSERT INTO hom_agent_shadow_reviews (shadow_log_id, verdict, issue_types, reason, suggested_fix, model)
SELECT l.id, 'ok', ARRAY[]::text[],
  'תלונה/שירות — העברה לנציג עם הודעה (תקין).', 'none', 'deterministic'
FROM hom_agent_shadow_logs l
LEFT JOIN hom_agent_shadow_reviews r ON r.shadow_log_id = l.id
WHERE r.id IS NULL
  AND l.action = 'human_service'
  AND l.draft_reply ~* 'הועבר|העבר(?:תי|נו)\s+א(?:ת|ת)?\s+הפנייה';

INSERT INTO hom_agent_shadow_reviews (shadow_log_id, verdict, issue_types, reason, suggested_fix, model)
SELECT l.id, 'ok', ARRAY[]::text[],
  'סגירת שיחה — אישור וסיום (תקין).', 'none', 'deterministic'
FROM hom_agent_shadow_logs l
LEFT JOIN hom_agent_shadow_reviews r ON r.shadow_log_id = l.id
WHERE r.id IS NULL
  AND l.action = 'end'
  AND COALESCE(trim(l.draft_reply), '') <> '';

INSERT INTO hom_agent_shadow_reviews (shadow_log_id, verdict, issue_types, reason, suggested_fix, model)
SELECT l.id, 'ok', ARRAY[]::text[],
  'אי-שביעות רצון — מדיניות החזרה (תקין).', 'none', 'deterministic'
FROM hom_agent_shadow_logs l
LEFT JOIN hom_agent_shadow_reviews r ON r.shadow_log_id = l.id
WHERE r.id IS NULL
  AND l.agent = 'faq'
  AND l.draft_reply ~* 'החלפ|החזר|returns\.carpetshop';

INSERT INTO hom_agent_shadow_reviews (shadow_log_id, verdict, issue_types, reason, suggested_fix, model)
SELECT l.id, 'ok', ARRAY[]::text[],
  'שאלת מוצר — בקשת קישור או העברה ליועץ (תקין).', 'none', 'deterministic'
FROM hom_agent_shadow_logs l
LEFT JOIN hom_agent_shadow_reviews r ON r.shadow_log_id = l.id
WHERE r.id IS NULL
  AND l.draft_reply ~* 'קישור לדף|אין לי גישה|יועץ מכירות|האם להעביר';

INSERT INTO hom_agent_shadow_reviews (shadow_log_id, verdict, issue_types, reason, suggested_fix, model)
SELECT l.id, 'ok', ARRAY[]::text[],
  'ברכה — תשובת פתיחה (תקין).', 'none', 'deterministic'
FROM hom_agent_shadow_logs l
LEFT JOIN hom_agent_shadow_reviews r ON r.shadow_log_id = l.id
WHERE r.id IS NULL
  AND trim(l.user_text) ~* '^(שלום|היי|הי|אהלן|מה\s+נשמע)'
  AND l.draft_reply ~* 'ברוכ(?:ים|ה)\s+הבא|שמח(?:ה|ים)|מה\s+נ(?:שמע|וכל)|איך\s+א(?:וכ|ו)ל\s+לעזור';

-- Pass 3: heuristic OK for remainder with header + reply
INSERT INTO hom_agent_shadow_reviews (shadow_log_id, verdict, issue_types, reason, suggested_fix, model)
SELECT l.id, 'ok', ARRAY[]::text[],
  'heuristic: תשובת reply עם כותרת תקינה.', 'none', 'deterministic'
FROM hom_agent_shadow_logs l
LEFT JOIN hom_agent_shadow_reviews r ON r.shadow_log_id = l.id
WHERE r.id IS NULL
  AND l.action = 'reply'
  AND COALESCE(trim(l.draft_reply), '') <> ''
  AND (l.draft_reply LIKE '%*הום בוט :)*%' OR trim(l.draft_reply) LIKE 'הום בוט :)%');

INSERT INTO hom_agent_shadow_reviews (shadow_log_id, verdict, issue_types, reason, suggested_fix, model)
SELECT l.id, 'ok', ARRAY[]::text[],
  'heuristic: handoff עם שורת העברה.', 'none', 'deterministic'
FROM hom_agent_shadow_logs l
LEFT JOIN hom_agent_shadow_reviews r ON r.shadow_log_id = l.id
WHERE r.id IS NULL
  AND l.action IN ('human_service', 'human_sales')
  AND l.draft_reply ~* 'הועבר|העבר(?:תי|נו)\s+א(?:ת|ת)?\s+הפנייה';
