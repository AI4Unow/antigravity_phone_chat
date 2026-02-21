# Antigravity Phone Connect — Project Guidelines

## Overview

This is a fork of [Antigravity Phone Connect](https://github.com/krishnakanthb13/antigravity_phone_chat) — a CDP-based (Chrome DevTools Protocol) real-time mobile interface for monitoring and controlling Antigravity sessions remotely.

The project uses `--remote-debugging-port=9000` to connect to Antigravity via CDP, then exposes a web UI + REST API that mirrors the chat and allows sending messages, switching models/modes, and browsing chat history.

## Goals for This Fork

### 1. Replace ngrok with Tailscale

We already have Tailscale installed, so we do NOT need ngrok for remote access. Changes needed:

- **Remove ngrok dependency** from `launcher.py` and `start_ag_phone_connect_web.sh/.bat`
- The server just needs to bind to `0.0.0.0:PORT` — Tailscale handles the networking
- Access via Tailscale hostname or IP (e.g., `http://<tailscale-hostname>:3000`)
- The `_web` launcher scripts should be simplified to just start the server without tunnel setup
- `.env` no longer needs `NGROK_AUTHTOKEN`
- Password auth (`APP_PASSWORD`) is still useful as an extra layer, but optional since Tailscale is already a private network

### 2. Agent Manager Control

The primary use case is to **control the Antigravity Agent Manager** remotely, not just the main chat. This requires:

- **Discover the Agent Manager's CDP target/context** — it may be an iframe (`#antigravity.agentPanel`) or a separate webview
- **Map the Agent Manager DOM** — use the existing `/debug-ui` and `ui_inspector.js` endpoints to explore:
  - Agent list / tabs
  - Input field for each agent
  - Send button
  - Stop button
  - Model/mode selectors per agent
  - Agent status indicators (busy/idle)
- **Add new API endpoints** for Agent Manager operations:
  - `GET /agents` — list active agents
  - `POST /agent/select` — switch to a specific agent
  - `POST /agent/send` — send message to the active agent
  - `POST /agent/stop` — stop the active agent
  - `GET /agent/status` — get agent's busy/idle state
  - `POST /agent/new` — create a new agent
- **Update the mobile UI** to show agent tabs/switcher

### 3. Future: Telegram Bot Frontend

After the CDP bridge works with Agent Manager, add a Telegram bot frontend:
- Polls Telegram for messages → forwards to Agent Manager via CDP
- Streams agent responses back to Telegram
- Telegram commands map to Agent Manager operations (`/agents`, `/use 2`, `/stop`, etc.)

## Architecture

```
Phone/Telegram
    │
    ▼
Node.js Server (server.js) ← binds to 0.0.0.0:3000
    │                           accessible via Tailscale
    ▼ CDP WebSocket
Antigravity (launched with --remote-debugging-port=9000)
    ├── Main Editor window
    └── Agent Manager panel ← this is what we want to control
```

## Key Files

| File | Purpose |
|------|---------|
| `server.js` | Main server — Express + WebSocket + CDP connection. **76KB**, the core of everything |
| `ui_inspector.js` | Utility to serialize and inspect Antigravity's DOM via CDP |
| `launcher.py` | Unified launcher — manages server, tunnel, QR codes. **Needs ngrok removal** |
| `generate_ssl.js` | SSL cert generator (still useful for HTTPS over Tailscale) |
| `public/` | Mobile web frontend (HTML/CSS/JS) |
| `start_ag_phone_connect.sh` | LAN launcher (works as-is with Tailscale) |
| `start_ag_phone_connect_web.sh` | Web launcher (**needs ngrok removal**) |

## How to Run (Current State — Before Modifications)

### Step 1: Launch Antigravity with debug port
```bash
antigravity . --remote-debugging-port=9000
```

### Step 2: Install dependencies
```bash
cd /path/to/AntigravityPhoneConnect
npm install
```

### Step 3: Create .env
```bash
cp .env.example .env
# Edit .env — set APP_PASSWORD, PORT=3000
```

### Step 4: Start the server
```bash
# LAN mode (works with Tailscale already):
./start_ag_phone_connect.sh

# Or directly:
node server.js
```

### Step 5: Access from phone
Open `http://<tailscale-hostname>:3000` in your phone browser.

## Implementation Priority

1. **Get it running as-is** — launch Antigravity with debug port, start server, verify CDP connection
2. **Remove ngrok** — simplify launchers, remove ngrok from `.env` and `launcher.py`
3. **Agent Manager discovery** — use `/debug-ui` to map the Agent Manager's DOM
4. **Agent Manager endpoints** — add `/agents`, `/agent/send`, etc. to `server.js`
5. **Update mobile UI** — add agent switcher to the phone interface
6. **Telegram integration** — add bot frontend as alternative to web UI

## Reference: Existing API Endpoints

The server already exposes these endpoints (see `CODE_DOCUMENTATION.md` for details):

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/snapshot` | GET | Captures current chat DOM |
| `/send` | POST | Sends a message to the chat |
| `/stop` | POST | Stops current generation |
| `/set-mode` | POST | Changes Fast/Planning mode |
| `/set-model` | POST | Changes AI model |
| `/new-chat` | POST | Starts new chat |
| `/chat-history` | GET | Lists conversations |
| `/select-chat` | POST | Switches conversation |
| `/app-state` | GET | Gets current mode/model |
| `/health` | GET | Server health check |
| `/debug-ui` | GET | Serialized DOM tree (for development) |
