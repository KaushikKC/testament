#!/bin/bash
# Local keeper runner — polls every 60 seconds.
# Usage: bash scripts/run-keeper.sh
# Stop with Ctrl+C

APP_URL="${APP_URL:-http://localhost:3000}"
INTERVAL="${INTERVAL:-60}"

echo "Keeper running — hitting $APP_URL/api/keeper every ${INTERVAL}s"
echo "Press Ctrl+C to stop."
echo ""

while true; do
  TIMESTAMP=$(date '+%H:%M:%S')
  RESPONSE=$(curl -s -X POST "$APP_URL/api/keeper")
  echo "[$TIMESTAMP] $RESPONSE"
  sleep "$INTERVAL"
done
