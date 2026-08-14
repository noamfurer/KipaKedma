# KipaKedma

קטלוג רספונסיבי למכירת כיפות סרוגות בעבודת יד. כל ההכנסות הן תרומה לקהילת קדמא.

## פיתוח מקומי

```bash
npm install
npx netlify dev
```

ההרצה דרך Netlify Dev מספקת לנתיבי ה-API את ההקשר הנדרש עבור Netlify Blobs.

## מסד נתונים

הזמנות נשמרות ב-Netlify Blobs בחנות האתר `kipa-kedma-reservations`:

- `reserved/<sku>` מסמן כיפה כלא זמינה באופן אטומי.
- `requests/<request-id>` שומר את פרטי הבקשה לתיאום ב-WhatsApp.

הכתיבה משתמשת ב-`onlyIfNew`, ולכן שתי בקשות מקבילות אינן יכולות לשמור את אותה כיפה.

## פרסום

האתר מותאם ל-Netlify עם Next.js App Router. הגדרות הבנייה נמצאות ב-`netlify.toml`.
