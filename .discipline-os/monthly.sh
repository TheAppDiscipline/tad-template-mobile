#!/usr/bin/env bash
# .discipline-os/monthly.sh — Discipline Loop monthly maintenance (mobile)
set -e

echo "Discipline Loop monthly maintenance (mobile) — $(date +%Y-%m-%d)"
echo ""

echo "=== 1/5 Backups verification ==="
echo "Manual: open your backend dashboard (Supabase/Firebase)."
echo "  -> Database -> Backups -> last successful backup <24h?"
echo ""

echo "=== 2/5 Bundle audit (Expo/Metro) ==="
if command -v expo >/dev/null 2>&1; then
  npx expo export || echo "⚠ expo export failed."
  echo "Check dist/ bundle size; target <2 MB Hermes bytecode."
else
  echo "⏭ Expo not installed; skipping bundle audit."
fi
echo ""

echo "=== 3/5 Performance re-check ==="
echo "Manual: run 'npx react-native-performance-tools' (if installed) or profile on device."
echo "  Startup <2s p95 (NN 20); list rendering with FlatList, no bridge spikes."
echo ""

echo "=== 4/5 Dependency budget ==="
if command -v depcheck >/dev/null 2>&1; then
  npx depcheck
else
  echo "Install once: npm install -g depcheck"
fi
echo ""

echo "=== 5/5 Findings review ==="
echo "Manual: review findings.md §Incidents from last 30 days."
echo ""

echo "Journal: findings.md §Maintenance/monthly"
