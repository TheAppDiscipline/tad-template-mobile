# Discipline Loop Mobile Template

Template repository for building mobile applications following the **Discipline Loop** methodology.

**Part of The App Discipline.** This is the public, MIT-licensed template (see `LICENSE`). The complete Discipline Loop methodology and vault (full system, playbooks, prompts, and extended materials) are a separate product, sold separately at https://theappdiscipline.gumroad.com/l/tad, and are **not** included in this repository.

**Stack:** Expo + React Native + TypeScript (strict) + Semantic design tokens

**Features:** Modular Backend Factory (Supabase, Firebase, Local), quality gates, pipeline automation scripts, agent integration via `AGENTS.md` (canonical; read by Codex, Cursor, Copilot, and Claude Code via a `CLAUDE.md` stub).

## Getting Started

**Prerequisite:** Node.js 22 or newer.

1. Click **Use this template** to create a new repository.
2. Clone your new repository.
3. Install dependencies: `npm install`
4. Configure your backend in `.env` using `.env.example`
5. Run the gate: `npm run gate`
6. Create a development build: `npx eas build --profile development --platform all`
7. Start development for that build: `npx expo start --dev-client`

## Recommended Operating Mode

After `npm install`, initialize the Discipline Loop structure if the project is still blank:

```bash
npm run discipline:hydrate -- --lane MOBILE --profile LITE --backend LOCAL_ONLY --auth NONE
```

For day-to-day pipeline work, the recommended mode is:

```bash
npm run discipline:watch
```

`discipline:watch` listens to `.discipline/packets/`, extracts patch blocks, applies them, updates `progress.md` when needed, and assembles the next `paste-ready` file automatically.

Use `discipline:patch` and `discipline:assemble` manually only as fallback.

## Key Files

| File | Purpose |
|---|---|
| `discipline.md` | Project constitution with switches, data model, contracts and Definition of Done |
| `task_plan.md` | Slice plan with statuses |
| `findings.md` | Decisions, risks and assumptions |
| `progress.md` | Current state, recent slices and open errors |
| `AGENTS.md` | Canonical agent instructions (Codex, Cursor, Copilot, Claude Code) |
| `CLAUDE.md` | Stub that imports `AGENTS.md` for Claude Code |
| `.discipline/` | Pipeline packets, patches, paste-ready files and run log |
| `.mcp.json.example` | Safe MCP starting point with minimal examples |
| `.pre-commit-config.yaml` | Optional local checks for Markdown and editorial consistency |
| `.github/workflows/docs.yml` | Optional pipeline and docs validation in PRs |
| `.github/workflows/security-review.yml` | Optional automated PR security review |

## Backend Selection

Configure in `.env` via `EXPO_PUBLIC_BACKEND_PROVIDER`:

| Provider | Install | Use case |
|---|---|---|
| **SUPABASE** (default) | `npm i @supabase/supabase-js` | Relational data + RLS security; sessions persist via Expo SecureStore |
| **FIREBASE** | `npm i firebase` | Firestore + Auth; sessions persist via AsyncStorage; use EMAIL_PASSWORD on Mobile |
| **LOCAL_ONLY** | none | Rapid prototyping with AsyncStorage |

Verify: `npm run backend:smoke`

### Firebase Production Setup

When `EXPO_PUBLIC_BACKEND_PROVIDER=FIREBASE`, install the Firebase SDK, configure `.env` from `.env.example.firebase`, and deploy the checked-in Firestore artifacts before launch/prod smoke tests:

```bash
firebase deploy --only firestore:rules,firestore:indexes
npm run firebase:smoke
```

- Rules: `firebase/firestore.rules`
- Indexes: `firebase/firestore.indexes.json`
- Firebase Mobile uses `EXPO_PUBLIC_AUTH_MODE=EMAIL_PASSWORD` in this template. Magic-link auth for Firebase Mobile requires a verified HTTPS callback and is intentionally not supported by the base template.
- Firebase projects that use phone auth, dynamic links, or production quota should have billing configured before public beta.

## Mobile Runtime

This template targets Expo development builds. Do not use Expo Go as the primary smoke path for this SDK line.

```bash
npm install
npx eas build --profile development --platform android
npx expo start --dev-client
```

Supabase magic-link auth uses the `tadapp://` scheme from `app.json`. Add `tadapp://auth/callback` to Supabase Auth Redirect URLs before testing magic links in a dev build. Supabase sessions persist through Expo SecureStore; very large session payloads can exceed practical SecureStore limits, so keep auth metadata lean and re-test after adding large custom claims. If you rename the app, update `scheme`, `ios.bundleIdentifier`, `android.package`, Supabase redirect URLs, Firebase authorized domains, and `.maestro/smoke.yaml`.

Firebase Mobile magic-link auth is not a V1 template path. Use `EMAIL_PASSWORD`, or choose Supabase when mobile magic links are required.

## Quality Gates

```bash
npm run gate        # expo lint + typecheck + tests + visual token check + secrets check
npm run gate:full   # same as gate (no bundle size check for native)
```

## Pipeline Automation (`discipline:*` scripts)

These scripts automate the mechanical operations between Discipline Loop pipeline steps:

```bash
npm run discipline:status     # Dashboard: where you are and what comes next
npm run discipline:patch      # Apply pending patch blocks to discipline.md/task_plan.md/findings.md/progress.md
npm run discipline:assemble   # Assemble the paste-ready file for the next step
npm run discipline:progress   # Update progress.md from SLICE_COMPLETION_PACKET
npm run discipline:log        # Append entry to the run log
npm run discipline:validate   # Check pipeline integrity and packet completeness
npm run discipline:watch      # Watch new packets and run the mechanical plumbing automatically
```

## Optional Repo Hardening

This template now includes the safe base for pipeline enforcement:

- `.mcp.json.example` with minimal MCP examples
- `.pre-commit-config.yaml` for local Markdown and Vale checks
- `.markdownlint-cli2.jsonc` for Markdown structure
- `.vale.ini` and `.vale/styles/DisciplineLoop/` for editorial consistency
- `.github/workflows/docs.yml` for docs and pipeline validation in pull requests
- `.github/workflows/security-review.yml` for automated PR security review

Recommended activation path:

1. Install dependencies with `npm install`
2. Optional: install `pre-commit` and enable it locally
3. Optional: install Vale on your machine
4. Keep `Docs CI` active for pull requests
5. Add `ANTHROPIC_API_KEY` only if you want automated security review on PRs

## AI Features (Optional)

If `AI_FEATURES=enabled` in `discipline.md`:

```bash
npm i -D openai           # or @google/genai or @anthropic-ai/sdk
npm run ai:smoke          # Verify provider responds
npm run ai:eval           # Run eval cases
```

When `AI_FEATURES=none`, AI scripts skip cleanly.

## MCP Setup (Optional)

Start from `.mcp.json.example` and enable only the servers the project really needs.

Recommended order:
- GitHub in read-only mode when you need PRs, Actions or issues in context
- Supabase only when the backend provider is Supabase

Do not add write-heavy MCPs by default.

## Project Structure

```text
src/
  lib/backend/        Modular adapters (Supabase, Firebase, Local)
  config/             Runtime configuration (provider, auth mode)
  theme/tokens.ts     Semantic design tokens
tools/
  discipline/         Pipeline automation scripts (discipline:*)
  *.js                Quality gates (smoke tests, token check, LLM eval)
.discipline/
  packets/            Handoff packets between pipeline steps
  patches/            Patch blocks (pending -> applied)
  paste-ready/        Pre-assembled prompts for next step
  run-log.md          Append-only pipeline execution log
```

## Methodology

- **Data-First:** Define contracts in `src/lib/backend/types.ts` before building UI
- **One Writer Per Slice:** Never have two agents editing the same slice
- **Semantic Tokens:** All styling through `theme/tokens.ts` with no hex hardcodes
- **Gates Before Merge:** `npm run gate` must pass before any commit
- **Anchor Rules:** Never rename headings in `discipline.md`, `task_plan.md`, `findings.md`, or `progress.md` because the `discipline:*` scripts depend on them
