#!/bin/bash

# Clean up ports used by Email Reader

echo "🧹 Cleaning up ports..."

# Ports to clean
PORTS=(3000 3001 4173 4174 5173)

for PORT in "${PORTS[@]}"; do
  PIDS=$(lsof -ti :$PORT 2>/dev/null)
  if [ -n "$PIDS" ]; then
    for PID in $PIDS; do
      echo "  ✓ Killing process on port $PORT (PID: $PID)"
      kill -9 $PID 2>/dev/null
    done
  else
    echo "  - Port $PORT already free"
  fi
done

# Wait for ports to be fully released
echo "  ⏳ Waiting for ports to release..."
sleep 2

# Verify ports are free
echo ""
echo "🔍 Verifying ports are free..."
ALL_CLEAR=true
for PORT in "${PORTS[@]}"; do
  if lsof -i :$PORT 2>/dev/null | grep -q LISTEN; then
    echo "  ✗ Port $PORT is still in use!"
    ALL_CLEAR=false
  else
    echo "  ✓ Port $PORT is free"
  fi
done

echo ""
if [ "$ALL_CLEAR" = true ]; then
  echo "✅ All ports cleaned!"
  exit 0
else
  echo "⚠️  Some ports are still in use. You may need to manually kill processes."
  exit 1
fi
