# VAULT Poker — Project Roadmap

> Full-stack multiplayer Texas Hold'em in React + Node.js/Socket.io

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

### 2.1 Deploy Infrastructure
- [x] Git repository initialized
- [x] GitHub repo created
- [ ] `railway.json` — one-click Railway deploy
- [ ] `render.yaml` — one-click Render deploy
- [ ] Server serves built React app (`dist/`) in production
- [ ] `VITE_SERVER_URL` handled for same-origin production
- [ ] `/api/health` endpoint for uptime monitoring
- [ ] `.env.example` with all required variables

### 2.2 Room Link Sharing
- [ ] `?room=XXXXX` URL parameter — auto-joins on load
- [ ] "Copy Link" button after room creation
- [ ] Share via native share API on mobile
- [ ] Room code shown prominently in game

### 2.3 Reconnect Logic
- [ ] Player reconnects with same name → restores their seat
- [ ] Reconnect within 5 minutes of disconnect (room kept alive)
- [ ] Toast notification when player reconnects
- [ ] Disconnected player shown as greyed out (not removed immediately)

---

## Phase 3 — Player Stats & History 📊 Planned

Give every player their own statistics and history.

### 3.1 Stats Screen (Public)
- [ ] Leaderboard — all players ranked by wins
- [ ] Per-player stats: wins, hands played, chips won, win rate
- [ ] Best hand ever achieved
- [ ] Biggest pot won
- [ ] Access via `/stats` route and lobby button

### 3.2 Action Log (Server)
- [ ] Save every action per hand: `{ playerName, action, amount, phase }`
- [ ] Save board cards and hole cards per hand
- [ ] Save all player results per hand
- [ ] Extend `handHistory` schema in `db.js`

### 3.3 Hand History (Per Player)
- [ ] Player searches by name → sees all their hands
- [ ] Each hand shows: date, result (W/L), pot, hand type, amount won/lost
- [ ] Filter by date range, hand type, room

---

## Phase 4 — Replay & Simulation 🎬 Planned

Watch any past hand play out card by card.

- [ ] Replay viewer UI — step through actions one by one
- [ ] "What would have happened" simulator — show all hands at showdown
- [ ] Share replay link
- [ ] Export hand history as JSON

---

## Phase 5 — Social Features 💬 Planned

Make the game feel alive with communication.

### 5.1 In-Game Chat
- [ ] Text messages visible to all players in room
- [ ] Emoji quick-reactions (👍 😮 🤑 💀)
- [ ] Chat history visible in sidebar
- [ ] Admin can mute players

### 5.2 Spectator Mode
- [ ] Join a room in progress as a spectator (no seat)
- [ ] See community cards, pot, and all bets
- [ ] See hole cards at showdown
- [ ] Spectator count shown to players
- [ ] Lobby shows "Spectate" button for in-progress rooms

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

*Last updated: 2026-05-10*
