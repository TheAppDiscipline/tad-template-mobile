#!/usr/bin/env bash
# .discipline-os/quarterly.sh — Discipline Loop quarterly maintenance (mobile)
set -e

echo "Discipline Loop quarterly maintenance (mobile) — $(date +%Y-%m-%d)"
echo "Timebox: 1 hour total."
echo ""

echo "=== 1/4 Full security review ==="
echo "- Agent(discipline-security-reviewer) on main branch."
echo "- gitleaks detect (full history)."
echo "- Mobile-specific: audit SecureStore entries + deep link validators."
echo ""

echo "=== 2/4 Compliance review ==="
echo "- Run generate-privacy-policy skill; diff vs current Privacy Policy."
echo "- Review ROPA for vendors (Supabase, Sentry, Resend, analytics)."
echo "- iOS ATT / Apple Privacy Nutrition Labels — still reflect reality?"
echo "- Google Play Data Safety declaration — still accurate?"
echo ""

echo "=== 3/4 Tech debt inventory ==="
echo "- TODO/FIXME grep:"
grep -rE 'TODO|FIXME|HACK' src/ 2>/dev/null | head -20 || echo "  None in src/."
echo "- progress.md §Open Errors >30 days?"
echo ""

echo "=== 4/4 Breach drill ==="
echo "Simulate one scenario from runbooks/breach.md (15 min)."
echo "Mobile-specific scenarios: deep link token leakage, SecureStore bypass on jailbroken, push token leakage."
echo ""
