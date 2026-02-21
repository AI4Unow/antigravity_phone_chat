#!/usr/bin/env node
/**
 * Antigravity Phone Connect — Terminal UI (TUI)
 * 
 * Lightweight blessed-based terminal interface for controlling Antigravity
 * remotely via SSH/tmux over Tailscale.
 * 
 * Usage: node tui.js [--host localhost] [--port 3000]
 * 
 * Keys:
 *   Enter       Send message
 *   Ctrl+S      Stop generation
 *   Ctrl+N      New chat
 *   Ctrl+M      Switch mode (Fast/Planning)
 *   Ctrl+O      Switch model
 *   Ctrl+H      Chat history
 *   Ctrl+R      Refresh
 *   Ctrl+C / q  Quit
 *   Tab         Focus input
 *   Up/Down     Scroll chat
 *   PgUp/PgDn   Scroll chat (fast)
 */

import blessed from 'blessed';
import http from 'http';
import https from 'https';
import { WebSocket } from 'ws';
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Config ---
const args = process.argv.slice(2);
function getArg(name, def) {
    const i = args.indexOf(`--${name}`);
    return i !== -1 && args[i + 1] ? args[i + 1] : def;
}
const hasFlag = (name) => args.includes(`--${name}`);

const HOST = getArg('host', 'localhost');
const PORT = parseInt(getArg('port', '3000'));

// Auto-detect HTTPS: check if certs exist or --https flag passed
const hasSSL = hasFlag('https') ||
    (fs.existsSync(join(__dirname, 'certs', 'server.key')) &&
        fs.existsSync(join(__dirname, 'certs', 'server.cert')));

const PROTOCOL = hasSSL ? 'https' : 'http';
const WS_PROTOCOL = hasSSL ? 'wss' : 'ws';
const BASE = `${PROTOCOL}://${HOST}:${PORT}`;
const WS_URL = `${WS_PROTOCOL}://${HOST}:${PORT}`;

// Allow self-signed certs
const httpClient = hasSSL ? https : http;
const REQUEST_OPTS = hasSSL ? { rejectUnauthorized: false } : {};

// --- HTTP Client ---
function apiGet(path) {
    return new Promise((resolve, reject) => {
        httpClient.get(`${BASE}${path}`, { timeout: 5000, ...REQUEST_OPTS }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { resolve(data); }
            });
        }).on('error', reject);
    });
}

function apiPost(path, body = {}) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const url = new URL(`${BASE}${path}`);
        const req = httpClient.request({
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
            timeout: 10000,
            ...REQUEST_OPTS,
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { resolve(data); }
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

// --- HTML to Text ---
function htmlToText(html) {
    if (!html) return '';

    let text = html;

    // Preserve code blocks
    text = text.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_, code) => {
        const decoded = decodeEntities(code.replace(/<[^>]+>/g, ''));
        return '\n```\n' + decoded.trim() + '\n```\n';
    });
    text = text.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, code) => {
        const decoded = decodeEntities(code.replace(/<[^>]+>/g, ''));
        return '\n```\n' + decoded.trim() + '\n```\n';
    });

    // Inline code
    text = text.replace(/<code[^>]*>(.*?)<\/code>/gi, (_, c) => '`' + decodeEntities(c.replace(/<[^>]+>/g, '')) + '`');

    // Headers
    text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n');
    text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n');
    text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n');
    text = text.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n#### $1\n');

    // Lists
    text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, '  • $1\n');

    // Line breaks
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/p>/gi, '\n');
    text = text.replace(/<\/div>/gi, '\n');
    text = text.replace(/<\/tr>/gi, '\n');

    // Blockquote
    text = text.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, q) => {
        return q.replace(/<[^>]+>/g, '').split('\n').map(l => '  > ' + l.trim()).join('\n') + '\n';
    });

    // Bold/italic
    text = text.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '*$1*');
    text = text.replace(/<b[^>]*>(.*?)<\/b>/gi, '*$1*');
    text = text.replace(/<em[^>]*>(.*?)<\/em>/gi, '_$1_');

    // Links
    text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)');

    // Strip remaining tags
    text = text.replace(/<[^>]+>/g, '');

    // Decode entities
    text = decodeEntities(text);

    // Clean up whitespace
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.trim();

    return text;
}

function decodeEntities(str) {
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));
}

// --- Blessed UI ---
const screen = blessed.screen({
    smartCSR: true,
    title: 'Antigravity Phone Connect',
    fullUnicode: true,
    cursor: { shape: 'line', blink: true, color: 'white' },
});

// Status bar (top)
const statusBar = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: '100%',
    height: 1,
    tags: true,
    style: { fg: 'white', bg: 'blue' },
});

// Chat area
const chatBox = blessed.box({
    parent: screen,
    top: 1,
    left: 0,
    width: '100%',
    height: '100%-4',
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: { ch: '│', style: { fg: 'cyan' } },
    mouse: true,
    keys: true,
    vi: true,
    style: { fg: 'white', bg: 'default' },
    padding: { left: 1, right: 1 },
});

// Help bar
const helpBar = blessed.box({
    parent: screen,
    bottom: 2,
    left: 0,
    width: '100%',
    height: 1,
    tags: true,
    style: { fg: 'black', bg: 'white' },
    content: ' {bold}^S{/}Stop {bold}^N{/}New {bold}^M{/}Mode {bold}^O{/}Model {bold}^H{/}History {bold}^R{/}Refresh {bold}^C{/}Quit',
});

// Input label
const inputLabel = blessed.box({
    parent: screen,
    bottom: 1,
    left: 0,
    width: 4,
    height: 1,
    tags: true,
    style: { fg: 'cyan', bg: 'default', bold: true },
    content: ' > ',
});

// Input box
const inputBox = blessed.textbox({
    parent: screen,
    bottom: 1,
    left: 4,
    width: '100%-4',
    height: 1,
    inputOnFocus: true,
    style: {
        fg: 'white',
        bg: '#1e1e1e',
        focus: { bg: '#2d2d2d' },
    },
});

// Feedback bar (bottom)
const feedbackBar = blessed.box({
    parent: screen,
    bottom: 0,
    left: 0,
    width: '100%',
    height: 1,
    tags: true,
    style: { fg: 'yellow', bg: 'default' },
});

// Modal overlay (for model/mode/history selection)
const modal = blessed.list({
    parent: screen,
    top: 'center',
    left: 'center',
    width: '60%',
    height: '50%',
    border: { type: 'line' },
    tags: true,
    keys: true,
    vi: true,
    mouse: true,
    scrollable: true,
    style: {
        fg: 'white',
        bg: '#1a1a2e',
        border: { fg: 'cyan' },
        selected: { bg: 'blue', fg: 'white', bold: true },
    },
    hidden: true,
});

// --- State ---
let currentMode = 'Unknown';
let currentModel = 'Unknown';
let connected = false;
let cdpConnected = false;
let lastChatText = '';
let ws = null;
let refreshTimer = null;

// --- Status Update ---
function updateStatus() {
    const connIcon = connected ? '{green-fg}●{/}' : '{red-fg}●{/}';
    const cdpIcon = cdpConnected ? '{green-fg}CDP{/}' : '{red-fg}CDP{/}';
    statusBar.setContent(
        ` ${connIcon} Antigravity  │  ${cdpIcon}  │  Mode: {bold}${currentMode}{/}  │  Model: {bold}${currentModel}{/}  │  {cyan-fg}${HOST}:${PORT}{/}`
    );
    screen.render();
}

function showFeedback(msg, color = 'yellow') {
    feedbackBar.setContent(` {${color}-fg}${msg}{/}`);
    screen.render();
    setTimeout(() => { feedbackBar.setContent(''); screen.render(); }, 3000);
}

// --- Chat Rendering ---
function renderChat(html) {
    const text = htmlToText(html);
    if (text === lastChatText) return;
    lastChatText = text;

    // Color the chat: user messages vs AI responses
    const lines = text.split('\n');
    const colored = lines.map(line => {
        // Detect user messages (typically start with "You:" or similar patterns)
        if (line.match(/^(You|Human|User)\s*:/i)) {
            return `{cyan-fg}{bold}${line}{/}`;
        }
        // Code blocks
        if (line.startsWith('```')) {
            return `{yellow-fg}${line}{/}`;
        }
        // Headers
        if (line.startsWith('#')) {
            return `{green-fg}{bold}${line}{/}`;
        }
        // Bullet points
        if (line.trimStart().startsWith('•')) {
            return `{white-fg}${line}{/}`;
        }
        return line;
    }).join('\n');

    chatBox.setContent(colored);

    // Auto-scroll to bottom
    chatBox.setScrollPerc(100);
    screen.render();
}

// --- API Actions ---
async function refreshSnapshot() {
    try {
        const snap = await apiGet('/snapshot');
        if (snap.html) {
            renderChat(snap.html);
        } else if (snap.error) {
            chatBox.setContent(`{yellow-fg}⏳ ${snap.error}{/}\n\n{white-fg}Waiting for an active chat in Antigravity...{/}`);
            screen.render();
        }
        connected = true;
    } catch (e) {
        connected = false;
        chatBox.setContent(`{red-fg}❌ Cannot connect to server at ${BASE}{/}\n\n{white-fg}Make sure the server is running: node server.js{/}`);
        screen.render();
    }
    updateStatus();
}

async function refreshState() {
    try {
        const state = await apiGet('/app-state');
        if (state.mode && state.mode !== 'Unknown') currentMode = state.mode;
        if (state.model && state.model !== 'Unknown') currentModel = state.model;
        updateStatus();
    } catch { /* ignore */ }
}

async function refreshHealth() {
    try {
        const h = await apiGet('/health');
        cdpConnected = h.cdpConnected || false;
        updateStatus();
    } catch {
        connected = false;
        cdpConnected = false;
        updateStatus();
    }
}

async function sendMessage(text) {
    if (!text.trim()) return;
    showFeedback('⏳ Sending...', 'yellow');
    try {
        const res = await apiPost('/send', { message: text });
        if (res.success) {
            showFeedback('✅ Sent', 'green');
            setTimeout(refreshSnapshot, 500);
            setTimeout(refreshSnapshot, 1500);
        } else {
            showFeedback('❌ Send failed: ' + (res.error || 'unknown'), 'red');
        }
    } catch (e) {
        showFeedback('❌ Send error: ' + e.message, 'red');
    }
}

async function stopGeneration() {
    showFeedback('⏳ Stopping...', 'yellow');
    try {
        const res = await apiPost('/stop');
        showFeedback(res.success ? '⏹ Stopped' : '❌ ' + (res.error || 'Failed'), res.success ? 'green' : 'red');
    } catch (e) {
        showFeedback('❌ ' + e.message, 'red');
    }
}

async function newChat() {
    showFeedback('⏳ Creating new chat...', 'yellow');
    try {
        const res = await apiPost('/new-chat');
        if (res.success) {
            showFeedback('✅ New chat created', 'green');
            setTimeout(refreshSnapshot, 800);
        } else {
            showFeedback('❌ ' + (res.error || 'Failed'), 'red');
        }
    } catch (e) {
        showFeedback('❌ ' + e.message, 'red');
    }
}

async function switchMode() {
    const newMode = currentMode === 'Fast' ? 'Planning' : 'Fast';
    showFeedback(`⏳ Switching to ${newMode}...`, 'yellow');
    try {
        const res = await apiPost('/set-mode', { mode: newMode });
        if (res.success !== false) {
            currentMode = newMode;
            showFeedback(`✅ Mode: ${newMode}`, 'green');
            updateStatus();
        } else {
            showFeedback('❌ ' + (res.error || 'Failed'), 'red');
        }
    } catch (e) {
        showFeedback('❌ ' + e.message, 'red');
    }
}

async function showModelPicker() {
    const models = [
        "Gemini 3.1 Pro (High)",
        "Gemini 3.1 Pro (Low)",
        "Gemini 3 Flash",
        "Claude Sonnet 4.6 (Thinking)",
        "Claude Opus 4.6 (Thinking)",
        "GPT-OSS 120B (Medium)",
    ];

    modal.setLabel(' {bold}Select Model{/} ');
    modal.setItems(models.map((m, i) => m === currentModel ? `{green-fg}● ${m}{/}` : `  ${m}`));
    modal.show();
    modal.focus();
    screen.render();

    return new Promise((resolve) => {
        const cleanup = () => {
            modal.hide();
            inputBox.focus();
            screen.render();
            modal.removeAllListeners('select');
            modal.removeAllListeners('cancel');
        };

        modal.once('select', async (_, idx) => {
            cleanup();
            const model = models[idx];
            showFeedback(`⏳ Switching to ${model}...`, 'yellow');
            try {
                await apiPost('/set-model', { model });
                currentModel = model;
                showFeedback(`✅ Model: ${model}`, 'green');
                updateStatus();
            } catch (e) {
                showFeedback('❌ ' + e.message, 'red');
            }
            resolve();
        });

        modal.once('cancel', () => { cleanup(); resolve(); });
        modal.key(['escape', 'q'], () => { modal.emit('cancel'); });
    });
}

async function showHistory() {
    showFeedback('⏳ Loading history...', 'yellow');
    try {
        const res = await apiGet('/chat-history');
        const chats = res.chats || [];

        if (chats.length === 0) {
            showFeedback('📭 No chat history found', 'yellow');
            return;
        }

        modal.setLabel(' {bold}Chat History{/} (Enter to select, Esc to close) ');
        modal.setItems(chats.map(c => `  ${c.title}`));
        modal.show();
        modal.focus();
        screen.render();

        return new Promise((resolve) => {
            const cleanup = () => {
                modal.hide();
                inputBox.focus();
                screen.render();
                modal.removeAllListeners('select');
                modal.removeAllListeners('cancel');
            };

            modal.once('select', async (_, idx) => {
                cleanup();
                const chat = chats[idx];
                showFeedback(`⏳ Loading "${chat.title}"...`, 'yellow');
                try {
                    await apiPost('/select-chat', { title: chat.title });
                    showFeedback(`✅ Loaded: ${chat.title}`, 'green');
                    setTimeout(refreshSnapshot, 800);
                } catch (e) {
                    showFeedback('❌ ' + e.message, 'red');
                }
                resolve();
            });

            modal.once('cancel', () => { cleanup(); resolve(); });
            modal.key(['escape', 'q'], () => { modal.emit('cancel'); });
        });
    } catch (e) {
        showFeedback('❌ History: ' + e.message, 'red');
    }
}

// --- WebSocket for live updates ---
function connectWs() {
    try {
        ws = new WebSocket(WS_URL, { rejectUnauthorized: false });

        ws.on('open', () => {
            connected = true;
            updateStatus();
        });

        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'snapshot_update') {
                    refreshSnapshot();
                }
            } catch { /* ignore */ }
        });

        ws.on('close', () => {
            connected = false;
            updateStatus();
            setTimeout(connectWs, 3000);
        });

        ws.on('error', () => {
            // Will trigger close
        });
    } catch {
        setTimeout(connectWs, 3000);
    }
}

// --- Key Bindings ---
inputBox.key(['C-s'], () => { stopGeneration(); });
inputBox.key(['C-n'], () => { newChat(); });
inputBox.key(['C-m'], () => { /* Ctrl+M is Enter in terminals, use C-t instead */ });
inputBox.key(['C-t'], () => { switchMode(); });
inputBox.key(['C-o'], () => { showModelPicker(); });
inputBox.key(['C-h'], () => { showHistory(); });
inputBox.key(['C-r'], () => { refreshSnapshot(); refreshState(); showFeedback('🔄 Refreshed', 'green'); });

screen.key(['C-s'], () => { stopGeneration(); });
screen.key(['C-n'], () => { newChat(); });
screen.key(['C-t'], () => { switchMode(); });
screen.key(['C-o'], () => { showModelPicker(); });
screen.key(['C-h'], () => { showHistory(); });
screen.key(['C-r'], () => { refreshSnapshot(); refreshState(); showFeedback('🔄 Refreshed', 'green'); });
screen.key(['C-c'], () => { cleanup(); process.exit(0); });
screen.key(['q'], () => {
    // Only quit if not focused on input or modal
    if (!inputBox.focused && !modal.visible) {
        cleanup();
        process.exit(0);
    }
});
screen.key(['tab'], () => { inputBox.focus(); });

// Submit message on Enter
inputBox.on('submit', (value) => {
    if (value.trim()) {
        sendMessage(value.trim());
    }
    inputBox.clearValue();
    inputBox.focus();
    screen.render();
});

// Cancel (Escape) returns focus to chat
inputBox.on('cancel', () => {
    chatBox.focus();
    screen.render();
});

// --- Startup ---
function cleanup() {
    if (ws) ws.close();
    if (refreshTimer) clearInterval(refreshTimer);
}

async function main() {
    // Initial UI
    chatBox.setContent('{yellow-fg}⏳ Connecting to Antigravity Phone Connect...{/}');
    updateStatus();
    screen.render();

    // Focus input
    inputBox.focus();

    // Initial data load
    await refreshHealth();
    await refreshSnapshot();
    await refreshState();

    // Connect WebSocket for live updates
    connectWs();

    // Periodic health + state refresh (every 10s)
    refreshTimer = setInterval(async () => {
        await refreshHealth();
        await refreshState();
    }, 10000);

    // Fallback polling if WebSocket fails (every 3s)
    setInterval(() => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            refreshSnapshot();
        }
    }, 3000);
}

main().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
});
