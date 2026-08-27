# Test fixtures — Hebrew utterances (shadow-derived)

Use for deterministic router tests + shadow comparison before deploy.

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
