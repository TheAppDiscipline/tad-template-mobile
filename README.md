# Discipline Loop Mobile Template

Template repository for building mobile applications following the **Discipline Loop** methodology.

**Part of The App Discipline.** This template is MIT-licensed (see `LICENSE`) and can be used on its own. The proprietary Discipline Loop vault is not covered by this repository's MIT license. If you received the paid bundle, the vault is the sibling folder `The App Discipline Vault/`; otherwise, verify the current offer and availability in the seller's checkout before relying on it.

**Stack:** Expo + React Native + TypeScript (strict) + Semantic design tokens

**Features:** Modular Backend Factory (Supabase, Firebase, Local), quality gates, pipeline automation scripts, agent integration via `AGENTS.md` (canonical; read by Codex, Cursor, Copilot, and Claude Code via a `CLAUDE.md` stub).

## Inicio rápido desde el bundle

Usa esta ruta si recibiste `Templates/tad-template-mobile` dentro del bundle de The App Discipline:

1. Copia esta carpeta completa a una carpeta de trabajo nueva. No trabajes dentro del bundle ni combines la copia con un proyecto anterior.
2. Abre una terminal en la copia. El directorio correcto contiene `package.json`.
3. Ejecuta, en orden:

```bash
npm install
npm run discipline:hydrate -- --lane MOBILE --profile LITE --backend LOCAL_ONLY --auth NONE --sync NONE
npm run discipline:status
npm run gate
```

En Windows PowerShell usa `npm.cmd` en lugar de `npm`. Si ves `npm.ps1 cannot be loaded`, repite el mismo comando con `npm.cmd`; no necesitas cambiar la política del sistema.

**Resultado esperado:** hydrate informa `Project hydrated`, status termina en `Status: OK` y gate vuelve al prompt sin error. Este gate demuestra lint, tipos, tests y guardianes locales. No demuestra dispositivo, development build, EAS, firma, App Store ni Play Store.

**Siguiente prueba manual:** para ejecutar la app necesitas un development build, una cuenta compatible y un dispositivo o emulador; sigue `Mobile Runtime` abajo. Si no tienes esos recursos, marca el runtime como no verificado y no lo presentes como un éxito.

**Si falla:** conserva el primer error rojo y el comando exacto. Corre `npm run discipline:doctor` (`npm.cmd run discipline:doctor` en PowerShell), corrige una causa a la vez y repite. Después de dos intentos sin información nueva, detente y registra el blocker en `progress.md`.

Para volver otro día, lee `progress.md` y corre `npm run discipline:status`. `LITE` es local; `LAUNCH` requiere evidencia antes de abrir a terceros; `PROD` requiere operación comercial verificada. La IA no decide por ti alcance, costos, credenciales, legal/fiscal, cobros, firma ni publicación.

## Getting Started

**Prerequisite:** Node.js 22 or newer.

1. Click **Use this template** to create a new repository.
2. Clone your new repository.
3. Install dependencies: `npm install`
4. Run the gate: `npm run gate`
5. Create a development build: `npx eas build --profile development --platform all`
6. Start development for that build: `npx expo start --dev-client`

The template starts with `LOCAL_ONLY`, so no `.env` is needed for the first run. `.env` holds credentials only after you choose a cloud backend in `discipline.md`.

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

Choose the provider in `discipline.md`, then generate the versioned runtime contract:

```bash
npm run discipline:provider:generate
```

The initial contract is `LOCAL_ONLY` / `NONE` and works without credentials. Do not set `EXPO_PUBLIC_BACKEND_PROVIDER` or `EXPO_PUBLIC_AUTH_MODE`; those former architecture variables are rejected.

| Provider | Install | Use case |
|---|---|---|
| **SUPABASE** | `npm i @supabase/supabase-js` | Relational data + RLS security; sessions persist via Expo SecureStore |
| **FIREBASE** | `npm i firebase` | Firestore + Auth; sessions persist via AsyncStorage; use EMAIL_PASSWORD on Mobile |
| **LOCAL_ONLY** (initial) | none | Rapid prototyping with AsyncStorage |

After choosing a cloud provider, copy its credential example (`.env.example.supabase` or `.env.example.firebase`) to `.env`, fill the credentials, then run `npm run gate:integration`.

### Firebase Production Setup

When `discipline.md` selects `BACKEND_PROVIDER: FIREBASE`, install the Firebase SDK, configure `.env` from `.env.example.firebase`, and deploy the checked-in Firestore artifacts before launch/prod smoke tests:

```bash
firebase deploy --only firestore:rules,firestore:indexes
npm run firebase:smoke
```

- Rules: `firebase/firestore.rules`
- Indexes: `firebase/firestore.indexes.json`
- Firebase Mobile uses `AUTH_MODE: EMAIL_PASSWORD` in `discipline.md`. Magic-link auth for Firebase Mobile requires a verified HTTPS callback and is intentionally not supported by the base template.
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

### Safe image assets

Metro reads image files from the project while it creates the JavaScript bundle. Before `gate` or an export, `npm run check-assets` now verifies the real magic bytes instead of trusting the filename, rejects ICNS/HEIF/JPEG XL input, rejects files over 10 MiB, and applies conservative PNG dimension limits. The check covers image files anywhere in the project except generated, dependency, internal-state, and vendored-source directories.

Do not copy an image from an unknown upload, message, ZIP, or website directly into the project. Save it outside the project first, verify its source and license, convert it with a trusted image editor to PNG/JPEG/WebP, copy the converted file into the project, and run `npm run check-assets` before `npm run gate` or `npx expo export`. A file renamed from `attack.icns` to `icon.png` is still rejected.

Images downloaded by the installed app at runtime do not pass through Metro. If your app accepts remote images or user uploads, add separate download limits, content-type and magic-byte validation, storage isolation, and failure handling in that feature's slice. The template's pre-Metro check does not claim to protect a remote service or runtime upload path.

The lockfile also pins a reviewed local security fork of `image-size`, the parser Metro currently invokes. Its source, compiled `dist`, MIT license, provenance, patches, tests, integrity-pinned tarball, and retirement plan are under `vendor/image-size-fork/`. Buyers do not need an account or private registry to install it; `npm ci` uses the checked-in tarball. `npm run check-vendored-deps` rebuilds that tarball from the shipped fork directory and requires its SHA-512 to match the lockfile exactly.

`npm run gate` also runs Expo's official dependency-alignment check. It needs access to the npm registry so it can detect a newly recommended compatible patch instead of treating an old local SDK patch as current. If it reports an expected version, use `npx expo install <packages named by the checker>`, review the lockfile diff, then rerun the gate; do not use `npm audit fix --force` or an incompatible downgrade.

## Quality Gates

```bash
npm run gate        # provider + Expo/fork compatibility + asset safety + lint + types + tests + local security checks
npm run gate:full   # gate + magic-number/query scans + AI fixture evaluation
npm run check-mobile-release # Expo export + artifact inspection (no store upload)
```

## Pipeline Automation (`discipline:*` scripts)

These scripts automate the mechanical operations between Discipline Loop pipeline steps:

```bash
npm run discipline:status     # Dashboard: where you are and what comes next
npm run discipline:metrics -- --slice S1 --base main  # Record measured scope by category
npm run discipline:state-view # Regenerate compact derived state
npm run --silent discipline -- state-view --json # JSON-only stdout (PowerShell: use npm.cmd)
npm run discipline:patch      # Apply pending patch blocks to discipline.md/task_plan.md/findings.md/progress.md
npm run discipline:assemble   # Assemble the paste-ready file for the next step
npm run discipline:progress   # Update progress.md from SLICE_COMPLETION_PACKET
npm run discipline:log        # Append entry to the run log
npm run discipline:validate   # Check pipeline integrity and packet completeness
npm run discipline:watch      # Watch new packets and run the mechanical plumbing automatically
```

## Optional Repo Hardening

This template includes the safe base for pipeline enforcement:

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
- Stitch only during Step 3; it can modify design assets, so use a dedicated key and disable it after the approved handoff
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
