# Council 06 — FAQ / KB Policy Map

Source: [`lib/agents/kb/faq.md`](../../lib/agents/kb/faq.md) — **inject full file always** into FAQ specialist prompt.

## Section index

| ## Section | Trigger questions (Hebrew) | Route | First-response essentials |
|------------|---------------------------|-------|---------------------------|
| Contact | שעות מוקד, *3076, אימייל | FAQ | CS hours א'-ה' 09-16; design chat 10-17 |
| Store hours | מתי פתוח, שישי | FAQ | א'-ה' 09:30-19:30; ו' 09-14; Airport City until 18:00 |
| Branches | סניפים, כתובת, טלפון סניף | FAQ | **Full list** all cities + address + phone |
| About | מי אתם, על החברה | FAQ | Founded 2014; Roomvo; link about page |
| Payments | תשלומים, bit, BUYME, פיס, צ'ק | FAQ | 12 payments; channel rules; **ask brand** for Pozitive/Mifal HaPais |
| Shipping policy | עלות משלוח, זמן אספקה, איסוף, קומה 4 | FAQ | Free >199₪ rugs; 4 business days rugs; 14 ready poufs; include shipping-policy URL |
| Refund/exchange/cancel | החזרה, ביטול, החלפה, לא מרוצה | FAQ first | **Always:** returns portal + 14 days + condition + branch/pickup + refund-policy URL |
| FAQ extra facts | אריזה, ניקוי, הדמיה, נשירה | FAQ | Visualization how-to → visualization-page URL |
| Carpet rental | השכרה, ניסיון לפני קנייה | FAQ → Sales offer | Case-by-case advisor discretion |
| Online consulting | ייעוץ אונליין | **Sales** | Intake → human (not terms dump) |
| Accessibility | נגישות | FAQ | Coordinator + accessibility URL |
| Privacy | פרטיות | FAQ | privacy-policy URL |
| Dated promotions | מבצע, 50%, 1+1 | **Sales human only** | Bot never quotes |
| Policy URLs block | (supporting) | FAQ | Include when answering matching topic |

## Live tools (not KB)

| Ask | Tool |
|-----|------|
| איפה ההזמנה שלי / מתי השליח | `getOrders` |
| SKU בסניפים | `getInventoryBranch` |
| חשבונית / קבלה | `getDocument` / `getReceipt` |

## Strict splits

- **General delivery time** → FAQ Shipping policy section
- **My order status** → Tool only
- **Return policy question** → FAQ
- **Execute return** after policy → Service
- **Exchange at branch** → FAQ; courier exchange with replacement product → Service offer

## Pozitive differences (enforce after brand confirm)

- Returns: network stores only (no shipment) for Pozitive products
- Mifal HaPais: השטיח האדום products only
