# Test iPhone 13 Pro

בדיקה ויזואלית של ה-VAULT Poker כפי שמשתמש אייפון 13 פרו רואה. מריץ Playwright/WebKit עם אימולציה של מכשיר, לוכד צילומי מסך בכל המצבים המעניינים, וכותב ל-`/tmp/poker-iphone13/`.

## הוראות

1. **התקנה (פעם אחת)** — Playwright + WebKit:
   ```bash
   cd /Users/shlomishemtov/Documents/Python/poker
   npm ls playwright >/dev/null 2>&1 || npm install -D playwright
   ls ~/Library/Caches/ms-playwright/webkit-* >/dev/null 2>&1 || npx playwright install webkit
   ```

2. **הרצה**:
   ```bash
   # ברירת מחדל: production, מצב offline-vs-bots (לובי + 5 שלבי משחק)
   node .claude/scripts/test-iphone13.mjs

   # רק מסך הלובי
   node .claude/scripts/test-iphone13.mjs --lobby-only

   # נגד localhost (לפני שמריצים: npm run dev)
   node .claude/scripts/test-iphone13.mjs http://localhost:5173
   ```

3. **קריאת הצילומים**: הסקריפט שומר ל-`/tmp/poker-iphone13/` ומדפיס נתיבים. השתמש ב-`Read` על כל אחד כדי לראות אותו (Claude מבין PNG).

4. **ניתוח** — בכל צילום בדוק:
   - **חפיפה**: שמות שחקנים / קלפי שחקנים / hover מעל הקלפים המשותפים.
   - **חיתוך**: רכיבים שיוצאים מעבר לקצוות הגלויים (התחתית והכותרת).
   - **קריאות**: המספרים על הקלפים, שמות שחקנים — לא מטושטשים, לא נחתכים.
   - **פיזור**: שני שחקנים סמוכים שהשמות שלהם נוגעים.
   - **layout flip**: במושבים תחתונים — שם **מעל** קלפים. במושבים עליונים — שם **מעל** קלפים. במושבי צד — קלפים מעל שם.

5. **דוח קצר למשתמש**: סכם בשורות מה תקין ומה צריך תיקון, עם references ל-`(file:line)` אם רלוונטי.

## הערות חשובות

- **iPhone 13 Pro = 390×844 DIP** עם DPR=3. ה-emulation דרך `devices['iPhone 13 Pro']` של Playwright.
- בודק את production כברירת מחדל (`vault-poker-production.up.railway.app`).
- **מה לא נבדק כאן**: 
  - תיקון `compactSelf` (הסתרת קלפי "אני" בשולחן) — פעיל **רק במצב online**. ה-offline-vs-bots לא מפעיל את הדגל, כך שהקלפים של "אני" יהיו על השולחן גם בצילומים. לבדיקה ידנית של זה: היכנס לחדר online במכשיר אמיתי.
  - מצב **multi-player online** — דורש שני clients במקביל; הסקריפט לא מטפל בזה.
- במצב offline ה-bots מנגנים אוטומטית. הסקריפט לוחץ CHECK / CALL כדי להתקדם בשלבים.
- אם השלב לא מתקדם תוך 8 ניסיונות — צילום נלקח של המצב הנוכחי בלי כפי שהוא.
- האנימציה של היפוך קלפים ב-showdown יכולה להיתקע ב-WebKit headless. הצילומים עדיין שימושיים לבדיקת **layout** (מיקומים, גדלים, חפיפות) — רק תוכן הקלף הספציפי עלול להראות פנים בצילום למרות שב-iPhone אמיתי יראה פנים-קדמיות.

$ARGUMENTS
