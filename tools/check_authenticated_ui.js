/**
 * Discipline Loop gate - Authenticated UI has an authenticated test that RUNS.
 *
 * The `authenticated-ui` surface exists because a screen behind a login fails in
 * ways a public one cannot: it renders somebody else's data, or it renders
 * nothing because the session was never established. `test:rls` and
 * `test:storage:privacy` prove the BACKEND isolates users; the public visual
 * gate proves the public screens render. Neither of them opens the app as a
 * signed-in user, so neither can catch either failure.
 *
 * This check fails closed on the three ways that verification goes missing:
 *
 *   1. `AUTH_MODE: NONE` in discipline.md. Then no slice can touch authenticated
 *      UI at all, and a packet that declared the surface contradicts the project.
 *   2. No file under `.maestro/authenticated/`.
 *   3. **Files that contain no flow.** A file with the right extension is not a
 *      flow: an empty one, or one holding only comments, looks identical to
 *      `readdir`. So every file is checked for the structure Maestro requires of
 *      a runnable flow (an `appId:` and at least one command), and zero runnable
 *      flows is a failure.
 *
 * It still does not try to judge whether a flow really signs in: reading intent
 * out of source is the kind of guess this pipeline refuses to make. What it
 * guarantees is that an authenticated suite exists, contains runnable flows,
 * and is the suite `npm run e2e:auth` then runs on a device.
 *
 * Exit 0 = the suite exists and at least one file is a runnable flow.
 * Exit 1 = it does not, and the surface would have verified nothing.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const dirFlag = args.indexOf('--project-dir');
const ROOT = dirFlag !== -1 && args[dirFlag + 1] ? path.resolve(args[dirFlag + 1]) : process.cwd();

/** Where this lane's authenticated flows live, how they are discovered, and what runs them. */
const SUITE = {
  dir: path.join('.maestro', 'authenticated'),
  extensions: ['.yaml', '.yml'],
  discover: null, // Maestro has no --list; see discoverFlows below.
  runner: 'npm run e2e:auth',
};

/**
 * Maestro's own minimum for a runnable flow: an `appId:` header and at least one command after the
 * `---` separator. A file with neither is a file, not a flow, and `maestro test` would either skip
 * it or die on it. This is structure the runner requires, not intent read out of prose.
 */
function discoverFlows(files) {
  const runnable = [];
  for (const name of files) {
    const text = fs.readFileSync(path.join(ROOT, SUITE.dir, name), 'utf-8');
    const hasAppId = /^appId\s*:\s*\S+/m.test(text);
    const body = text.split(/^---\s*$/m).slice(1).join('\n');
    const hasCommand = /^\s*-\s+\S/m.test(body);
    if (hasAppId && hasCommand) runnable.push(name);
  }
  return runnable;
}

/** POSIX form for messages: path.join gives backslashes on Windows and the docs use forward slashes. */
const SUITE_DIR = SUITE.dir.split(path.sep).join('/');

function fail(lines) {
  console.error(`[check-authenticated-ui] FAILED: ${lines[0]}`);
  for (const line of lines.slice(1)) console.error(`  ${line}`);
  process.exit(1);
}

function readAuthMode() {
  const disciplinePath = path.join(ROOT, 'discipline.md');
  if (!fs.existsSync(disciplinePath)) return null;
  const match = fs.readFileSync(disciplinePath, 'utf-8').match(/^-\s*AUTH_MODE:\s*(\S+)/m);
  return match ? match[1].replace(/#.*$/, '').trim().toUpperCase() : null;
}

function authenticatedFiles() {
  const dir = path.join(ROOT, SUITE.dir);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && SUITE.extensions.some((ext) => entry.name.endsWith(ext)))
    .map((entry) => entry.name);
}

const authMode = readAuthMode();
if (authMode === null) {
  fail([
    'discipline.md not found or it declares no AUTH_MODE.',
    'This check is what the `authenticated-ui` surface routes to, and it cannot run without the switch.',
  ]);
}

if (authMode === 'NONE') {
  fail([
    `discipline.md declares AUTH_MODE: ${authMode}.`,
    'Nothing in this project is behind a login, so no slice can touch authenticated UI.',
    'Either the packet declared `authenticated-ui` by mistake, or AUTH_MODE is out of date.',
  ]);
}

const files = authenticatedFiles();
if (files.length === 0) {
  fail([
    `no authenticated test under ${SUITE_DIR}/.`,
    `AUTH_MODE is ${authMode}, so this project has screens behind a login, and this slice touches them.`,
    'Write at least one flow there that signs in and asserts what the signed-in screen shows.',
    `${SUITE.runner} runs that directory.`,
  ]);
}

// Ask what Maestro would actually run. A file is not a flow.
const runnable = discoverFlows(files);
if (runnable.length === 0) {
  fail([
    `no runnable flow in ${SUITE_DIR}/.`,
    `${files.length} file(s) are there, and none of them declares an appId and a command.`,
    'An empty file, a file holding only comments, and a half-written flow all look the same on disk.',
    'A Maestro flow needs `appId: <your app>`, then `---`, then at least one command.',
  ]);
}

console.log(`[check-authenticated-ui] OK: ${runnable.length} flow(s) in ${SUITE_DIR}/, run by ${SUITE.runner}.`);
process.exit(0);
