# VAULT Poker — דוח משימות ובאגים

עדכון אחרון: 2026-05-11

---

## 🔴 P0 — חקריטי (שוברי משחק)

### 1. `spectator_state` דורס את קלפי השחקן
**בעיה:** `broadcastSpectatorsInRoom` שולח `spectator_state` ל-**כולם** בחדר, כולל שחקנים.
`OnlineGameScreen` מאזין לשניהם (`game_state` ו-`spectator_state`) עם אותה פונקציה `onState = state => setGs(state)`.
אם `spectator_state` מגיע **אחרי** `game_state` — השחקן רואה `['??','??']` במקום הקלפים שלו.

**קובץ:** `server/index.js:117`, `src/screens/OnlineGameScreen.jsx:90`

**פתרון:** להסיר את `socket.on('spectator_state', onState)` מהשחקן הרגיל, או לשלוח `spectator_state` רק לצופים (מחזיקים ברשימה נפרדת).

---

### 2. אין התמדת חדרים — כל server restart מוחק משחקים פעילים
**בעיה:** `const rooms = new Map()` — כל ה-state בזיכרון. Railway מפעיל מחדש בכל deploy. שחקנים מאמצע משחק מוצאים חדר ריק.

**קובץ:** `server/index.js:56`

**פתרון:** לשמור snapshot של state החדר ב-SQLite (דרך `db.js` הקיים) בכל שינוי phase, ולשחזר חדרים פעילים בעת startup.

---

### 3. "יד חדשה" — כל שחקן יכול להתחיל לבד בלי שאחרים מוכנים
**בעיה:** כל שחקן שלוחץ "יד חדשה" מתחיל מיד. שחקן שלא ראה את הסיכום עדיין ייכנס לסבב חדש.

**קובץ:** `server/index.js:309`, `src/screens/OnlineGameScreen.jsx:138`

**פתרון:** לדרוש שכל השחקנים (שמחוברים) ילחצו "מוכן". רק כשכולם מוכנים — `buildHand`.

---

### 4. שחקן שיצא נשאר בשולחן ומקבל קלפים
**בעיה:** אין event של `leave_room`. כששחקן לוחץ "יציאה" הוא עובר ללובי, אבל בשרת הוא עדיין ב-`room.state.players`. בסבובים הבאים הוא מקבל קלפים, הטיימר רץ, ו-auto-fold מתבצע עבורו — עד שיתנתק לגמרי.

**קובץ:** `server/index.js:323` (disconnect בלבד)

**פתרון:** להוסיף event `leave_room` שמסיר את השחקן מ-`players` (אם phase=waiting) או מסמן אותו כ-"out" עם auto-fold לכל שאר הסבוב.

---

## 🟡 P1 — חשוב (משפיע על חוויה)

### 5. אין טיימר ויזואלי במשחק אונליין
**בעיה:** `GameScreen` (אופליין) מציג countdown animation. `OnlineGameScreen` לא — השחקן לא רואה כמה זמן נשאר לו.

**קובץ:** `src/screens/OnlineGameScreen.jsx` (חסר לחלוטין)

**פתרון:** השרת כבר שולח `settings.timer`. להוסיף `useEffect` שמריץ countdown מקומי כשמגיע `action_event` מסוג `new_hand` / `phase`, ולאפס אותו בכל action. להציג progress bar מעל כפתורי הפעולה.

---

### 6. המשחק תקוע בשולחן אם שחקן מתנתק בזמן showdown
**בעיה:** אחרי showdown, צריך לחכות שמישהו ילחץ "יד חדשה". אם הנוכחות מחוברת רק 1 שחקן — אחרים לא יכולים לאלץ התחלה.

**קובץ:** `server/index.js:309`

**פתרון:** הוסף auto-timer של ~15 שניות: אם אף אחד לא לחץ "יד חדשה" — השרת קורא `engine.rotateDealerForNewHand` + `engine.buildHand` ומשדר.

---

### 7. Blinds עולים — feature קיים בהגדרות אך לא ממומש
**בעיה:** `settings.blindsUp = true` קיים בלובי עם toggle, אך `engine.js` ו-`index.js` מתעלמים ממנו לחלוטין.

**קובץ:** `server/game/engine.js:buildHand`

**פתרון:** בתחילת כל hand, אם `blindsUp` מופעל — להעלות SB/BB ב-25% כל X ידות (למשל כל 5 ידות).

---

### 8. חדרי lobby לא מציגים הגדרות
**בעיה:** רשימת החדרים מציגה רק שם + ספירת שחקנים. אין מידע על buy-in, blinds, או עמלה — קשה לבחור שולחן.

**קובץ:** `src/screens/LobbyScreen.jsx:209`

**פתרון:** להוסיף שורת info: `💰 1000 · 🎯 10/20 · ⏱️ 30s` לכל חדר ברשימה. השרת כבר שולח `settings` ב-`list_rooms`.

---

### 9. Re-buy שקט — שחקן מקבל chips בלי הודעה
**בעיה:** `buildHand` בודק `p.ch <= 0` ומרבאי אוטומטית, אך אין הודעה בממשק.

**קובץ:** `server/game/engine.js:83`

**פתרון:** להוסיף שדה `rebuyed: true` לשחקן, ולהציג toast "שחקן X רבאי בסבוב זה".

---

### 10. הודעת "מחובר מחדש" — הבאנר נשאר אחרי reconnect
**בעיה:** הבאנר האדום "מחבר מחדש..." נעלם רק כשה-socket מחובר. אם השחקן reconnect מהיר — הבאנר מהבהב ונעלם. אך אין אינדיקציה שהחיבור הצליח חזרה.

**קובץ:** `src/screens/OnlineGameScreen.jsx:397`

**פתרון:** להציג flash ירוק "✓ חובר מחדש" ל-2 שניות אחרי reconnect.

---

## 🟢 P2 — שיפורים ואבטחה

### 11. אין rate limiting על create_room / join_room
**בעיה:** לקוח יכול לשלוח אינסוף requests ולמלא את הזיכרון.

**פתרון:** הגבל ל-5 create_room לדקה לכל IP באמצעות `express-rate-limit`.

---

### 12. אין validation ל-playerName בשרת
**בעיה:** שם ריק, שם ארוך מ-20 תווים, או שם עם תווים מיוחדים עוברים ללא בדיקה.

**קובץ:** `server/index.js:186`

**פתרון:**
```js
if (!playerName?.trim() || playerName.length > 20) {
  cb?.({ success:false, error:'שם שחקן לא תקין' }); return;
}
```

---

### 13. אין validation לסכום ה-RAISE בשרת
**בעיה:** לקוח יכול לשלוח `amount: -999` או `amount: 999999999`. המנוע יקבע `Math.min` נכון, אך כדאי לדחות מראש.

**קובץ:** `server/index.js:260`

---

### 14. `chatOpen` stale closure — unread לא מתעדכן נכון
**בעיה:** `chatOpen` בתוך `onChat` handler תמיד `false` (ערך ראשוני בזמן ה-mount). גם כשהצ'אט פתוח, counter עולה.

**קובץ:** `src/screens/OnlineGameScreen.jsx:63`

**פתרון:** להשתמש ב-`useRef` לעקוב אחר `chatOpen`:
```js
const chatOpenRef = useRef(false);
useEffect(() => { chatOpenRef.current = chatOpen; }, [chatOpen]);
// ב-onChat:
if (!chatOpenRef.current) setUnread(u => u + 1);
```

---

### 15. ריבוי חדרים מתים בזיכרון
**בעיה:** כל disconnect מריץ `setTimeout` של 5 דקות. מספר disconnects לאותו חדר יוצרים timeouts מרובים. הראשון שרץ מוחק את החדר, השאר מנסים `rooms.get` ומוצאים `undefined`.

**קובץ:** `server/index.js:333`

**פתרון:** הוסף `WeakMap` או flag על החדר לסמן שהוא בתהליך cleanup, כדי למנוע ריצות כפולות.

---

### 16. הטיימר האוטומטי לא מריץ `startTurnTimer` לאחר phase advance
**בעיה:** כשהטיימר מפעיל auto-fold/check ומוביל לשינוי phase — יש `startTurnTimer(room)` רק אם `!result.handOver` ולא כשה-phase השתנה.

**בדיקה:** שורה 120 — `else startTurnTimer(room)` רץ רק אם `!result.handOver`. אם phase השתנה, הוא עדיין קורא `startTurnTimer`. נראה תקין. **לאמת בפועל.**

---

### 17. לוח מובילים לא מוצג ב-mobile כראוי
**בדיקה:** `StatsScreen` לא נבדק על mobile. כדאי לוודא שהטבלה responsive.

---

## 📋 סדר ביצוע מומלץ

| # | משימה | קושי | השפעה |
|---|-------|------|--------|
| 1 | תקן `spectator_state` דורס קלפים | קל | 🔴 גבוהה |
| 2 | הוסף `leave_room` event | בינוני | 🔴 גבוהה |
| 3 | auto-timer להתחלת יד חדשה (15s) | קל | 🟡 בינונית |
| 4 | טיימר ויזואלי באונליין | בינוני | 🟡 בינונית |
| 5 | תקן `chatOpen` stale closure | קל | 🟢 נמוכה |
| 6 | validation שם שחקן בשרת | קל | 🟢 נמוכה |
| 7 | הצג הגדרות חדר ברשימה | קל | 🟡 בינונית |
| 8 | ממש Blinds עולים | בינוני | 🟡 בינונית |
| 9 | "מוכן" לפני יד חדשה | בינוני | 🟡 בינונית |
| 10 | התמדת חדרים ב-SQLite | קשה | 🔴 גבוהה |
