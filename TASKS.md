# VAULT Poker — דוח משימות ובאגים

עדכון אחרון: 2026-05-12

מקרא: ✅ הושלם · ⬜ פתוח · 🚧 חלקי / לאמת

---

## 🎯 הבא בתור

| # | משימה | קושי | השפעה |
|---|-------|------|--------|
| 9 | flash ירוק "✓ חובר מחדש" | קל | 🟡 בינונית |
| 10 | הודעת re-buy בממשק | קל | 🟡 בינונית |
| 11 | `handleExit` כש-socket מנותק | קל | 🟡 בינונית |
| 12 | rate-limit `create_room`/`join_room` | קל | 🟢 נמוכה |
| 13 | rate-limit `chat_message` | קל | 🟢 נמוכה |

---

## 🟡 P1 — פתוחים

### ⬜ 9. אין flash ירוק אחרי reconnect מוצלח
**בעיה:** הבאנר האדום "מחבר מחדש..." נעלם מיד כשה-socket מחובר, בלי אינדיקציה חיובית. בריקונקט מהיר הוא מהבהב ונעלם.

**קובץ:** [src/screens/OnlineGameScreen.jsx](src/screens/OnlineGameScreen.jsx) (סביב באנר הניתוק)

**פתרון:** flash ירוק "✓ חובר מחדש" ל-2 שניות אחרי `connect` event.

---

### ⬜ 10. Re-buy שקט — שחקן מקבל chips בלי הודעה
**בעיה:** `buildHand` בודק `p.ch <= 0` ומריבאי אוטומטית, אך אין הודעה בממשק.

**קובץ:** [server/game/engine.js:85](server/game/engine.js#L85)

**פתרון:** סמן שדה `rebuyed: true` לשחקן בתחילת hand. בלקוח — toast "שחקן X רבאי בסבוב זה". איפוס הדגל בסוף ה-hand.

---

### ⬜ 11. `handleExit` לא שולח `leave_room` כש-socket מנותק
**בעיה:** ב-[src/screens/OnlineGameScreen.jsx:211](src/screens/OnlineGameScreen.jsx#L211): `if (!isSpectator && socket?.connected) socket.emit('leave_room')`. אם השחקן יוצא כשה-socket בריקונקט — המידע לא נשלח. השחקן ייחשב מחובר עד ל-cleanup (5 דק').

**פתרון:** הסר את ה-guard `socket?.connected` — Socket.IO buffers ב-default. או סמן ב-localStorage ושלח על reconnect.

---

## 🟢 P2 — פתוחים

### ⬜ 12. אין rate limiting על `create_room` / `join_room`
**בעיה:** לקוח יכול לשלוח אינסוף requests ולמלא את הזיכרון.

**פתרון:** `express-rate-limit` ל-HTTP, או counter ידני על socket id (5 לדקה).

---

### ⬜ 13. אין rate limit על `chat_message`
**בעיה:** [server/index.js](server/index.js) — שחקן יכול לשלוח אינסוף הודעות. הצפת ה-chat.

**פתרון:** `Map<socketId, lastChatAt>`, דחה הודעה אם פחות מ-500ms עברו.

---

### ⬜ 14. סיסמת חדר נשלחת בגלוי (plaintext)
**בעיה:** `join_room` payload כולל password ב-plaintext, ונשמרת כך ב-`room.settings.password`.

**פתרון:** hash סיסמאות עם bcrypt בשרת. הלקוח שולח plaintext מעל WSS, השרת משווה hash-to-hash.

---

### ⬜ 15. `db.saveRoom` שגיאות שותקות — אובדן נתונים שקט
**בעיה:** [server/index.js:83](server/index.js#L83) — fire-and-forget. PG down → שום אינדיקציה.

**פתרון:** עטיפת error: `logger.error('db', 'saveRoom נכשל', ...)` + event `db_error` ל-admins.

---

### ⬜ 16. PostgreSQL pool — `max:5` ללא `idleTimeoutMillis`
**בעיה:** [server/db.js:42-46](server/db.js#L42). תחת עומס (6+ בו זמנית) — חסימה.

**פתרון:**
```js
new Pool({ ..., max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 });
```

---

### ⬜ 17. אין validation: `buyIn >= SB + BB`
**בעיה:** ניתן ליצור חדר עם buyIn=100, SB=200, BB=400. SB/BB יורדים ל-0 ב-`Math.min`, המשחק "באוויר".

**פתרון:** validation בלקוח ובשרת (ב-`create_room` handler).

---

### ⬜ 18. `setGs` אחרי unmount — React warning
**בעיה:** listeners של socket עדיין פעילים בעת unmount. הודעה שמגיעה בין `handleExit` ל-cleanup → `setGs` על unmounted component.

**פתרון:** `mountedRef = useRef(true); useEffect(() => () => { mountedRef.current = false; }, [])`. הגנה לפני setState.

---

### ⬜ 19. `StatsScreen` שגיאות API שותקות
**בעיה:** `catch(() => setLeaderboard([]))` — אם /api/stats נופל, רואים "אין נתונים" במקום שגיאה.

**פתרון:** `setError(e.message)` + באנר אדום.

---

### ⬜ 20. `StatsScreen` לא responsive במובייל
**בדיקה:** הטבלה לא נבדקה במובייל. וודא גלילה אופקית, fontSize מותאם.

---

### ⬜ 21. אין notification sound כשהתור של השחקן
**בעיה:** רק countdown ויזואלי. שחקן ב-tab אחר מפספס.

**פתרון:** beep קצר על `gs.turn === myIdx` (עם mute באפשרויות).

---

### 🚧 22. הטיימר האוטומטי לאחר phase advance (לאמת)
**סטטוס:** נראה תקין בקוד הנוכחי. **לאמת בפועל בבדיקת run-through.**

---

## 🟦 P3 — מנוע פוקר (Engine edge cases)

### ⬜ 23. `awardPots` — שארית תמיד הולכת לשחקן הראשון
**בעיה:** [server/game/pots.js:46-48](server/game/pots.js#L46): כש-split לא מתחלק שווה — winners[0] מקבל +1 בכל פעם.

**פתרון:** רוטציה לפי dealer position.

---

### ⬜ 24. UTG כשכל השחקנים all-in
**בעיה:** [server/game/engine.js:120-121](server/game/engine.js#L120): אם כולם `ch<=0` — `utg` נשאר על all-in. הפעולה תיכשל או תדלג בלי לקדם phase.

**פתרון:** אם הלולאה לא מצאה — קרא ל-`advancePhase` ישירות.

---

### ⬜ 25. `nextActive`/`nextActiveWithChips` — אין הגנת fallback
**בעיה:** [server/game/engine.js:127-131](server/game/engine.js#L127): כשלולאה נכשלת מחזירה `nx` שגוי. Callers לא בודקים.

**פתרון:** החזר `-1` אם `tries >= n`, ובדוק בכל caller.

---

## 📦 ארכיון — הושלם

| # | משימה | קובץ / קומיט |
|---|-------|---------------|
| — | `spectator_state` דורס קלפים | [server/index.js:93](server/index.js#L93) |
| — | התמדת חדרים ב-PostgreSQL | 22cbbf1 |
| — | `leave_room` event | [server/index.js:444](server/index.js#L444) |
| — | טיימר ויזואלי אונליין | 2906db0 |
| — | auto-timer 15s ליד חדשה | [server/index.js:151](server/index.js#L151) |
| — | הגדרות חדר בלובי | [LobbyScreen.jsx:218](src/screens/LobbyScreen.jsx#L218) |
| — | validation שם שחקן | [server/index.js:181](server/index.js#L181) |
| — | validation סכום RAISE | [server/index.js:362](server/index.js#L362) |
| — | `chatOpen` stale closure | 2906db0 |
| 1 | **Zombie turn-timer** — guard ב-setTimeout | [server/index.js:179](server/index.js#L179) |
| 2 | **Dealer rotation** אחרי `leave_room` ו-`new_hand` | [server/index.js:122,440](server/index.js#L122) |
| 3 | **`pagehide` listener** — סגירת tab | [OnlineGameScreen.jsx:128](src/screens/OnlineGameScreen.jsx#L128) |
| 4 | **שחזור deadline טיימר** ב-reconnect | server שולח `turnStartedAt`, לקוח מסנכרן |
| 5 | **מערכת "מוכן"** לפני יד חדשה | `player_ready` event + UI |
| 6 | **Blinds עולים** (25% כל 5 ידות) | [engine.js:62-78](server/game/engine.js#L62) |
| 7 | **Double-action protection** (≥150ms) | [server/index.js:362](server/index.js#L362) |
| 8 | **Single cleanup timer** per room | [server/index.js:130](server/index.js#L130) |

---

## 📊 סטטוס כללי

- **הושלם בסשנים אחרונים:** 17 פריטים (9 קודם + 8 בסשן הזה)
- **נשארו פתוחים:** 17 פריטים (0 P0, 3 P1, 11 P2, 3 P3)
- **הבא בתור:** #9 (flash ירוק reconnect) — UX קצר, סוגר loop של "מצב חיבור"
