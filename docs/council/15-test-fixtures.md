# Test fixtures — Hebrew utterances (shadow-derived)

Use for deterministic router tests + shadow comparison before deploy.

## Council QA workflow (Conversation Contract Registry)

Every production bug becomes a **versioned contract** in `lib/hom-agent/contracts/registry.ts`.

### Operator workflow

1. Customer complains → `npm run contracts:import -- --session CONVERSATION_ID` (or `--phone`)
2. Tighten assertions in the draft JSON under `lib/hom-agent/contracts/drafts/`
3. Promote draft into `registry.ts`
4. Fix in order: **runtime → hints/prompt → contract** (see `.cursor/rules/conversation-fix-playbook.mdc`)
5. `npm run test:contracts` green → push → no manual WhatsApp for that class

### Promotion rule (Enforcer)

- **First occurrence:** hint/prompt fix allowed **only with a new contract**
- **Second occurrence of same bug class with hint-only fix:** **must** add structured runtime guard (pre-turn, FAQ coercion, document defer) before closing
- **Third occurrence:** runtime guard mandatory — no exceptions

### CI gate

- Vercel `prebuild` runs `test:gold && test:contracts`
- Legislator collision pairs: `lib/hom-agent/__tests__/legislator-collision-pairs.test.ts`
- Sentinel nightly: `/api/cron/violation-scanner` (GOKU ≤6 + violation patterns → draft contracts)

## Routing (expected department)

| # | Customer message | Expected route |
|---|------------------|----------------|
| 1 | שירות לקוחות | FAQ topic prompt |
| 2 | נציג | FAQ topic prompt |
| 3 | היי | Greeting no header |
| 4 | תודה | Warm reply, action=reply |
| 5 | איפה המשלוח שלי | Tool shipping |
| 6 | מתי מגיע בדרך כלל | FAQ shipping policy |
| 7 | לא מרוצה מהשטיח | FAQ returns |
| 8 | השטיח הגיע קרוע | Service |
| 9 | התאמת מחיר | FAQ credit |
| 10 | כמה עולה קזבלנקה | Sales URL request |
| 11 | פרטים נוספים לגבי SYDNEY | Sales URL request |
| 12 | 31501090-200290 יש בסניפים | Tool inventory |
| 13 | רוצה לקנות שטיח לסלון | Sales intake |
| 14 | שלחו לי קבלה | Tool document |
| 15 | איזה סניפים יש | FAQ full branch list |
| 16 | יש מבצע 50% | Sales human (no promo text) |
| 17 | כן (after handoff offer) | human_sales or human_service |
| 18 | עדיין כאן? ack: כן | Inactivity ack |
| 19 | API fail on shipping | Service offer |
| 20 | לא מרוצה + רוצה להחזיר | FAQ portal first |

## NEVER-do violations to reject

- Reply containing "אבדוק במלאי"
- Empty reply with shipping action
- human_service on message #1 (שירות לקוחות)
- Sales intake on message #9 (התאמת מחיר)
- Gendered "תרצי" or "שלח/י"
