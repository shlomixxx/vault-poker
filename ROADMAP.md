# VAULT Poker — Project Roadmap

> Full-stack multiplayer Texas Hold'em in React + Node.js/Socket.io

**🌐 Live:** https://vault-poker-production.up.railway.app  
**GitHub:** https://github.com/shlomixxx/vault-poker  
**Admin Panel:** `/admin` (password: set via `ADMIN_PASSWORD` env var)

---

## Current Stack

| Layer | Technology |
|-------|-----------|
| Client | React 18, Vite 5, Socket.io-client |
| Server | Express 4, Socket.io 4, Node.js |
| Storage | JSON file (`server/data.json`) |
| Language | Hebrew (RTL), English labels |

---

## Phase 1 — Foundation ✅ Complete

Core poker engine and basic UI.

- [x] Texas Hold'em rules (preflop → flop → turn → river → showdown)
- [x] Hand evaluation (High Card → Royal Flush)
- [x] Side pot & split pot computation
- [x] Offline mode (vs AI bots)
- [x] Online multiplayer (Socket.io rooms)
- [x] Turn timer with bank time
- [x] Admin panel (win boosts, history, stats)
- [x] Sound effects (Web Audio API)
- [x] Action log overlay
- [x] Hand strength meter
- [x] Card flip animations
- [x] Responsive mobile UI

---

## Phase 2 — Production Ready 🔄 In Progress

Everything needed to play with real friends over the internet.

### 2.1 Deploy Infrastructure ✅
- [x] Git repository initialized
- [x] GitHub repo created → https://github.com/shlomixxx/vault-poker
- [x] `railway.json` — one-click Railway deploy
- [x] `render.yaml` — one-click Render deploy
- [x] Server serves built React app (`dist/`) in production
- [x] `VITE_SERVER_URL` handled for same-origin production
- [x] `/api/health` endpoint for uptime monitoring
- [x] **Deployed live → https://vault-poker-production.up.railway.app**

### 2.2 Room Link Sharing ✅
- [x] `?room=XXXXX` URL parameter — auto-joins on load
- [x] "Copy Link" / 🔗 button with native share API on mobile
- [x] Room code shown prominently in game top bar

### 2.3 Reconnect Logic ✅
- [x] Player reconnects with same name → restores their seat
- [x] Reconnect within 5 minutes of disconnect (room kept alive)
- [x] Toast notification when player reconnects
- [x] Disconnected player marked `connected: false` (not removed)

---

## Phase 3 — Player Stats & History 📊 ✅ Complete

Give every player their own statistics and history.

### 3.1 Stats Screen (Public) ✅
- [x] Leaderboard — all players ranked by wins with win-rate bar
- [x] Per-player stats: wins, hands played, chips won, win rate, biggest pot
- [x] Access via "📊 לוח מובילים" button in lobby
- [x] `/api/stats` public REST endpoint

### 3.2 Action Log (Server) ✅
- [x] Save every action per hand: `{ playerName, action, amount, phase }`
- [x] Save board cards per hand
- [x] Extend `handHistory` schema in `db.js`

### 3.3 Hand History (Per Player) ✅
- [x] Player searches by name → sees last 30 hands
- [x] Each hand shows: date, result (W/L), pot, hand type, amount won/lost
- [x] `/api/stats/:name` endpoint

---

## Phase 4 — Replay & Simulation 🎬 Planned

Watch any past hand play out card by card.

- [ ] Replay viewer UI — step through actions one by one
- [ ] "What would have happened" simulator — show all hands at showdown
- [ ] Share replay link
- [ ] Export hand history as JSON

---

## Phase 5 — Social Features 💬 ✅ Complete

Make the game feel alive with communication.

### 5.1 In-Game Chat ✅
- [x] Text messages visible to all players + spectators in room
- [x] Unread messages badge on chat button
- [x] Sender name shown per message

### 5.2 Spectator Mode ✅
- [x] Join a room in progress as spectator (no seat)
- [x] See community cards, pot, bets
- [x] See hole cards at showdown
- [x] Lobby shows 🔴 LIVE badge + "👁️ צפה" button for in-progress rooms
- [x] Spectator label in top bar

---

## Phase 6 — Player Profiles & Persistence 👤 Planned

Persistent identities with balances carried between sessions.

- [ ] Player profile: name, avatar, total chips balance
- [ ] Chips persist between sessions (stored in DB)
- [ ] Cash-game buy-in/cash-out ledger
- [ ] Rebuy during game
- [ ] Profile page with full stats history
- [ ] Optional PIN-code login per player name

---

## Phase 7 — Tournament Mode 🏆 Planned

Structured tournaments with blind levels.

- [ ] Blind schedule: levels auto-increase every N minutes
- [ ] Blind level display in top bar
- [ ] Antes support
- [ ] Elimination — players out when chips reach 0 (no rebuy in tourney)
- [ ] Final table detection
- [ ] Tournament results leaderboard

---

## Phase 8 — Advanced Features ⚡ Future

Quality-of-life and power-user features.

- [ ] PWA — installable on phone home screen
- [ ] Push notifications when it's your turn
- [ ] Multiple tables / multi-room tournament
- [ ] Hand strength HUD (VPIP, PFR, aggression factor)
- [ ] Pre-action buttons (auto-fold, auto-check)
- [ ] Rabbit hunting (see what cards would have come)
- [ ] Straddle / Mississippi straddle
- [ ] Time bank visual countdown (current: numeric only)

---

## Deployment Guide

### Railway (Recommended)
```bash
# 1. Push to GitHub
git push origin main

# 2. Go to railway.app → New Project → Deploy from GitHub
# 3. Set environment variables:
#    PORT=3001 (auto-set by Railway)
#    ADMIN_PASSWORD=your_secure_password
#    NODE_ENV=production

# 4. Railway auto-detects and runs:
#    npm install → npm run build → node server/index.js
```

### Render
```bash
# Use render.yaml in repo root — Render auto-configures on connect
```

### Manual VPS
```bash
npm install
npm run build
cd server && npm install
NODE_ENV=production node server/index.js
```

---

## Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `PORT` | `3001` | No | Server port |
| `NODE_ENV` | `development` | Yes (prod) | Set to `production` to serve static files |
| `ADMIN_PASSWORD` | `admin123` | Yes | Admin panel password |
| `VITE_SERVER_URL` | `http://localhost:3001` | Dev only | Socket.io server URL (leave empty in prod) |

---

## Known Limitations (Current)

| Issue | Impact | Fix Phase |
|-------|--------|-----------|
| Chips reset on page refresh | Medium | Phase 6 |
| No reconnect if kicked from room | Medium | Phase 2 |
| Admin password stored in data.json | Low | Phase 6 |
| Single JSON file for all data | Low | Phase 6 |
| No rate limiting on socket events | Low | Phase 2 |

---

*Last updated: 2026-05-11*
