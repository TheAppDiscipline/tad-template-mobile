/**
 * Discipline Loop gate - Mobile deployable artifact readiness.
 *
 * The `deployment-artifact` surface exists so that a change to what gets shipped
 * is checked against what shipping needs. On Web that is the bundle, on Desktop
 * the native identifier and lockfile, on the Extension the manifest and package.
 * On Mobile it is `app.json` / `eas.json`: the store identifiers, the version,
 * and the assets the build embeds. None of those are code, so lint, types and
 * tests all pass while the artifact is unbuildable or ships under the template's
 * own bundle id.
 *
 * Everything here is read from the files, never inferred: a missing key is a
 * failure with the key named, and a placeholder identifier is a failure with the
 * value quoted.
 *
 * **Then it builds the artifact and looks at it.** Config that parses is not a
 * bundle that exists: an import that resolves nowhere, a Metro alias that only
 * works in dev, an asset the bundler cannot find, all leave `app.json` perfectly
 * valid. So this runs `expo export` and checks the output the same way the Web
 * lane's `check-bundle` runs `npm run build`, and the Extension lane's
 * `check-bundle-extension` runs after `wxt build`.
 *
 * `--export-dir <dir>` inspects an export somebody else already produced (CI
 * that builds once, or a test), instead of producing one here.
 *
 * Exit 0 = the artifact declares what a build needs AND the bundle came out.
 * Exit 1 = it does not.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = process.cwd()
const appConfigPath = path.join(ROOT, 'app.json')
const easConfigPath = path.join(ROOT, 'eas.json')

function fail(message) {
    console.error(`[FAIL] ${message}`)
    process.exitCode = 1
}

/** Identifiers the template ships with. Shipping under one of these is shipping as the template. */
function isTemplateIdentifier(value) {
    return typeof value === 'string' && /theappdiscipline|tad-app|example|placeholder|changeme|com\.anonymous/i.test(value)
}

if (!fs.existsSync(appConfigPath)) {
    fail('Missing app.json. Expo reads the artifact configuration from it, so a build has nothing to declare.')
} else {
    let expo = null
    try {
        expo = JSON.parse(fs.readFileSync(appConfigPath, 'utf8'))?.expo ?? null
    } catch (err) {
        fail(`app.json is not valid JSON: ${err.message}`)
    }

    if (expo) {
        if (!expo.name) fail('app.json: expo.name is missing; the store listing and the installed app take their name from it.')
        if (!expo.version) fail('app.json: expo.version is missing; every store upload needs a version to compare against the last one.')

        const ios = expo.ios?.bundleIdentifier
        const android = expo.android?.package
        if (!ios) fail('app.json: expo.ios.bundleIdentifier is missing; an iOS build cannot be signed or uploaded without it.')
        else if (isTemplateIdentifier(ios)) fail(`app.json: expo.ios.bundleIdentifier is still the template's (${ios}). Replace it with your own before packaging.`)

        if (!android) fail('app.json: expo.android.package is missing; an Android build cannot be signed or uploaded without it.')
        else if (isTemplateIdentifier(android)) fail(`app.json: expo.android.package is still the template's (${android}). Replace it with your own before packaging.`)

        // The assets the build embeds: a path that does not resolve produces a build that ships
        // a blank icon or fails at submission, and nothing else in the gate looks at them.
        for (const [key, value] of [
            ['expo.icon', expo.icon],
            ['expo.splash.image', expo.splash?.image],
            ['expo.android.adaptiveIcon.foregroundImage', expo.android?.adaptiveIcon?.foregroundImage],
        ]) {
            if (!value) continue
            const resolved = path.join(ROOT, value.replace(/^\.\//, ''))
            if (!fs.existsSync(resolved)) fail(`app.json: ${key} points at ${value}, which does not exist.`)
        }
    }
}

if (!fs.existsSync(easConfigPath)) {
    fail('Missing eas.json. The build profiles live there; without it there is no reproducible way to produce the artifact.')
} else {
    try {
        const eas = JSON.parse(fs.readFileSync(easConfigPath, 'utf8'))
        if (!eas.build || Object.keys(eas.build).length === 0) {
            fail('eas.json declares no build profiles, so `eas build` has nothing to run.')
        }
    } catch (err) {
        fail(`eas.json is not valid JSON: ${err.message}`)
    }
}

// --- The artifact itself ------------------------------------------------------

/**
 * What an Expo export has to contain to be an artifact: the manifest Metro writes
 * and at least one non-trivial JS bundle. An export that produced no bundle is a
 * build that shipped nothing, and it looks like success to anything that only
 * checks the exit code.
 */
function inspectExport(dir) {
    if (!fs.existsSync(dir)) {
        fail(`the export produced no output directory (${dir}).`)
        return
    }
    if (!fs.existsSync(path.join(dir, 'metadata.json'))) {
        fail(`the export has no metadata.json in ${dir}; Metro writes it for every real export.`)
    }
    const bundles = []
    const walk = (current) => {
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const full = path.join(current, entry.name)
            if (entry.isDirectory()) walk(full)
            else if (/\.(hbc|js)$/.test(entry.name)) bundles.push(full)
        }
    }
    walk(dir)
    const substantial = bundles.filter((file) => fs.statSync(file).size > 1024)
    if (substantial.length === 0) {
        fail(
            bundles.length === 0
                ? 'the export contains no JS bundle at all; nothing would ship.'
                : `the export's ${bundles.length} bundle(s) are all under 1 KB, which is not an app.`,
        )
    } else {
        console.log(`[PASS] Export produced ${substantial.length} bundle(s), largest ${Math.round(Math.max(...substantial.map((f) => fs.statSync(f).size)) / 1024)} KB.`)
    }
}

// Only build when the config is sound: exporting a project whose app.json is broken produces a
// second, noisier failure about the same thing.
if (!process.exitCode) {
    const flag = process.argv.indexOf('--export-dir')
    const provided = flag !== -1 ? process.argv[flag + 1] : null

    if (provided) {
        console.log(`[check-mobile-release] Inspecting the export at ${provided} (not building one).`)
        inspectExport(path.resolve(provided))
    } else {
        const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'expo-export-'))
        console.log('[check-mobile-release] Running expo export (this builds the artifact; it is not fast)...')
        const exported = spawnSync(`npx expo export --platform all --output-dir "${outDir}"`, {
            cwd: ROOT,
            encoding: 'utf8',
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        })
        if (exported.status !== 0) {
            const detail = `${exported.stderr || ''}${exported.stdout || ''}`.trim().split(/\r?\n/).filter(Boolean).slice(-4)
            fail('expo export failed, so this project cannot produce a deployable artifact:')
            for (const line of detail) console.error(`         ${line}`)
        } else {
            inspectExport(outDir)
        }
        fs.rmSync(outDir, { recursive: true, force: true })
    }
}

if (process.exitCode) {
    console.error('Fix: update app.json (identifiers, version, assets) and eas.json build profiles, make the export succeed, then rerun this check.')
} else {
    console.log('[PASS] Mobile deployable artifact readiness checks passed.')
}
