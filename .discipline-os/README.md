# .discipline-os/ — Maintenance Automation (Discipline Loop)

Scripts to keep solo-builder maintenance from becoming "intention without habit". The doctrine behind them lives in The App Discipline vault (sold separately).

## Setup

Add these entries to your `package.json` under `scripts`:

```json
{
  "scripts": {
    "discipline-os:weekly": "bash .discipline-os/weekly.sh",
    "discipline-os:monthly": "bash .discipline-os/monthly.sh",
    "discipline-os:quarterly": "bash .discipline-os/quarterly.sh"
  }
}
```

## Cadence

| Script | Cadence | Time | What it checks |
|---|---|---|---|
| `weekly` | Every Monday | <2 min | `npm outdated` · `npm audit` · `npm run gate` · short report |
| `monthly` | First Sunday of the month | <10 min | Backups verification · bundle audit · Lighthouse re-run · dependency budget · findings review |
| `quarterly` | Jan/Apr/Jul/Oct 1st | <1 h | Full security review (delegates to `discipline-security-reviewer` subagent) · compliance review · tech debt inventory · breach runbook drill |

## Mobile-specific notes (React Native / Expo)

- `weekly.sh`: works out-of-the-box.
- `monthly.sh`: the bundle audit uses Metro bundler output; verify sizes with `npx expo export` + inspect `dist/`.
- Lighthouse does not apply to native; substitute with `npx react-native-performance-tools` or EAS build analytics.
- `quarterly.sh`: the breach drill on mobile adds extra scenarios (OAuth token leakage via deep link, exposed `expo-secure-store` entries).

## Integration options

- **Manual:** calendar reminder -> run script -> journal in `findings.md §Maintenance`.
- **EAS workflows:** for monthly/quarterly, wrap the scripts in an EAS workflow if you prefer CI-triggered runs.

## Windows compatibility

Scripts require bash. On Windows: use Git Bash or WSL.
