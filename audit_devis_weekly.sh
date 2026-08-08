#!/bin/bash
cd /Users/moctar/batispot-devis-app
LOG=/Users/moctar/batispot-devis-app/audit_devis.log
TS=$(date "+%Y-%m-%d %H:%M")
OUT=$(/usr/bin/env node audit_devis.js 2>&1); CODE=$?
echo "===== $TS (exit=$CODE) =====" >> "$LOG"
echo "$OUT" >> "$LOG"
if [ "$CODE" -ne 0 ]; then
  osascript -e 'display notification "Audit devis : des BLOQUANTS détectés — voir audit_devis.log" with title "BatiSpot Audit" sound name "Basso"' 2>/dev/null
  osascript -e 'tell application "Reminders" to make new reminder with properties {name:"⚠️ Audit devis hebdo : bloquants à corriger (audit_devis.log)"}' 2>/dev/null
fi
