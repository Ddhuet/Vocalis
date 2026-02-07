#!/bin/bash
# Note: You may need to make this script executable with: chmod +x run.sh

echo "=== Building Vocalis Frontend ==="

# Build the frontend
cd frontend
npm run build
if [ $? -ne 0 ]; then
    echo "Failed to build frontend. Make sure npm dependencies are installed."
    exit 1
fi
cd ..

echo "=== Frontend built successfully ==="
echo "=== Starting Vocalis Server ==="

# Determine which terminal command to use based on OS and available commands
terminal_cmd=""
if [ "$(uname)" == "Darwin" ]; then
    # macOS (try to use Terminal.app)
    if command -v osascript &> /dev/null; then
        terminal_cmd="osascript"
    fi
elif command -v gnome-terminal &> /dev/null; then
    terminal_cmd="gnome-terminal"
elif command -v xterm &> /dev/null; then
    terminal_cmd="xterm"
elif command -v konsole &> /dev/null; then
    terminal_cmd="konsole"
fi

# Load environment variables from backend/.env
export $(grep -v '^#' backend/.env | xargs)

# Start server (backend serves frontend on the same port)
if [ "$terminal_cmd" == "osascript" ]; then
    # macOS specific approach
    osascript -e 'tell app "Terminal" to do script "cd \"'$(pwd)'\" && source ./env/bin/activate && python -m backend.main"'
elif [ -n "$terminal_cmd" ]; then
    # For Linux with available terminal
    $terminal_cmd -- bash -c "cd '$(pwd)' && source ./env/bin/activate && python -m backend.main; exec bash" &
else
    # Fallback - start in background
    echo "Could not detect terminal. Starting server in background."
    source ./env/bin/activate && python -m backend.main &
    SERVER_PID=$!
    echo "Server started with PID: $SERVER_PID"
    echo
    echo "Press Ctrl+C to terminate the server and exit"
    trap "kill $SERVER_PID 2>/dev/null" EXIT
    wait
fi

echo "=== Vocalis server started ==="
echo "Access the app at: http://${SERVER_HOST:-0.0.0.0}:${SERVER_PORT:-7744}"
echo "Server is listening on: ${SERVER_HOST:-0.0.0.0}:${SERVER_PORT:-7744}"
