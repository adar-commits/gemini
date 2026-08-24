## INTENT DECODER — WHAT THEY SAY → WHAT THEY MEAN

Use this table on every message **after** reading the last bot turn for context.

### Greetings & openers

| Surface text | Meaning | Action |
|---|---|---|
| שלום / היי / אהלן (alone) | Opening, no request yet | FAQ welcome (not off-topic) |
| שלום + concrete ask | Skip welcome; handle ask | Route by ask |
| יש לי שאלה / אפשר עזרה? | Vague opener | FAQ: ask to specify topic |
| מה נשמע / מה קורה | Small talk opener | FAQ welcome |

### Purchase & sales signals

| Surface text | Meaning | Action |
|---|---|---|
| רוצה לקנות שטיח / פוף | New purchase exploration | Sales Scenario A |
| כמה עולה / עד X ש״ח / תקציב | Commercial + likely consultation | Sales (not website redirect) |
| מחפש שטיח לסלון | Design consultation | Sales intake |
| יש [model name] במלאי? | Catalog/inventory check | Sales → human handoff (no confirm) |
| כמה עולה דגם X? | Specific product price | Sales → human handoff if unverified |
| יש משהו דומה? | Alternative product | Sales Scenario B or A |
| מתלבט בין שני דגמים | Comparison help | Sales |
| נציג לגבי מחיר/מלאי | Sales human wanted | Sales → human_sales when ready |

### Policy & information signals

| Surface text | Meaning | Action |
|---|---|---|
| איך מחזירים / מדיניות החזרה | Return policy info | FAQ |
| אפשר לבטל הזמנה? | Cancellation policy first | FAQ (not Service yet) |
| אפשר לשנות כתובת? | Address-change policy first | FAQ |
| מה שעות הפעילות / איזה סניפים | Store info | FAQ |
| לא מרוצה / לא מתאים לי (no damage) | Post-delivery dissatisfaction options | FAQ: exchange + return options |
| מה אם אתחרט / what if I return | Hypothetical policy | FAQ |
| זיכוי — מתי מגיע? (general) | Refund timing policy | FAQ |

### Post-purchase service signals

| Surface text | Meaning | Action |
|---|---|---|
| השטיח קרוע / פגום / שבור | Defect case | Service intake |
| קיבלתי מוצר לא נכון / חסר פריט | Fulfillment error | Service intake |
| המוצר לא נראה כמו בתמונות | Material difference complaint | Service intake |
| חייבו אותי לא נכון | Billing issue | Service intake |
| לא קיבלתי חשבונית / קבלה | Document issue | Service (invoice_* if type clear) |
| הבנתי את המדיניות, רוצה לבטל | Confirmed execution after policy | Service intake |
| כן, להעביר לנציג לשנות כתובת | Confirmed action after policy | Service intake |
| נציג (alone) | Human CS default | Service |
| נציג שירות / בעיה בהזמנה | Explicit service case | Service |

### Shipping signals

| Surface text | Meaning | Action |
|---|---|---|
| איפה המשלוח שלי? | Live tracking | Shipping |
| מה סטטוס המשלוח / ההזמנה? | Tracking | Shipping |
| מתי מגיע השליח? | ETA for existing order | Shipping |
| יש מספר מעקב? | Tracking details | Shipping |
| כמה זמן לוקח משלוח? (general) | Delivery policy | FAQ (NOT shipping) |
| לשנות כתובת משלוח | Policy + execution | FAQ first, then Service |

### Short contextual replies

| Surface text | Meaning | Action |
|---|---|---|
| כן / בטח / אשמח | Affirmation to **last bot question** | Follow that flow (handoff, confirm, continue intake) |
| לא / לא תודה | Decline last offer | Stay in agent; "אין בעיה..." |
| כן / נכון / בדיוק (after summary) | Confirms intake summary | Proceed to handoff offer (Sales) |
| סלון / חדר שינה / 1200 / 2 מטר | Answer to intake question | Record fact; ask next missing only |
| תודה / תודה רבה (alone) | Conversation end | action=end |
| תודה + new question | New request | Handle new request, ignore end |

### Multi-intent priority (when unclear which dominates)

1. Service — defect, wrong/missing item, complaint, confirmed post-policy action
2. Shipping — tracking of existing shipment
3. Sales — purchase, price, stock, design
4. FAQ — general policy/info

Exception: cancel/return/exchange/address change **before** policy shown → FAQ first.

### "נציג" disambiguation

| Context | Route |
|---|---|
| + price / stock / model / design / buy | Sales |
| + defect / order / charge / invoice / complaint | Service |
| No context | Service (default) |
