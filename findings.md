<!--
  This file is filled progressively as your project advances. /discipline-step1
  seeds it; later steps add Decisions, Open Questions, Risks, Constraints,
  Assumptions and Deferred items via patch blocks. Do NOT rename the H2 section
  headings; discipline:patch depends on exact heading text.
-->

# findings.md — Discoveries, Assumptions, Constraints

## Decisions
- N/A

## Open Questions
- N/A

## Risks
- `npm audit --omit=dev --audit-level=high` is the release gate for production dependencies. The current Expo dependency chain reports 9 moderate advisories through `uuid`/`xcode`/Expo config tooling; no high vulnerabilities are present, and the suggested force fix downgrades Expo, so this is documented rather than force-applied.

## Constraints
- N/A

## Assumptions
- N/A

## Deferred
- N/A
