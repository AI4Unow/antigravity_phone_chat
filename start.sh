#!/bin/bash
# Antigravity Phone Connect — tmux launcher
#
# Usage:
#   ./start.sh         Start server + TUI in tmux
#   ./start.sh server  Start only the server in tmux
#   ./start.sh tui     Start only the TUI (server must be running)
#   ./start.sh stop    Stop everything

SESSION="ag-phone"
DIR="$(cd "$(dirname "$0")" && pwd)"

case "${1:-all}" in
  stop)
    tmux kill-session -t "$SESSION" 2>/dev/null && echo "⏹ Stopped" || echo "Not running"
    exit 0
    ;;
  server)
    tmux kill-session -t "$SESSION" 2>/dev/null
    tmux new-session -d -s "$SESSION" -c "$DIR" "node server.js"
    echo "✅ Server started in tmux session '$SESSION'"
    echo "   tmux attach -t $SESSION"
    ;;
  tui)
    exec node "$DIR/tui.js" "$@"
    ;;
  all|"")
    tmux kill-session -t "$SESSION" 2>/dev/null
    # Create session with server in window 0
    tmux new-session -d -s "$SESSION" -n "server" -c "$DIR" "node server.js"
    # Create TUI in window 1
    tmux new-window -t "$SESSION" -n "tui" -c "$DIR" "sleep 2 && node tui.js"
    # Focus TUI window
    tmux select-window -t "$SESSION:tui"

    echo "✅ Started in tmux session '$SESSION'"
    echo ""
    echo "📱 Connect from phone:"
    echo "   ssh <tailscale-hostname>"
    echo "   tmux attach -t $SESSION"
    echo ""
    TS_IP=$(tailscale ip -4 2>/dev/null)
    [ -n "$TS_IP" ] && echo "   Or web UI: http://$TS_IP:3000"
    echo ""
    echo "💡 tmux attach -t $SESSION   # attach now"
    ;;
esac
