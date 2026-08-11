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
 * Exit 0 = the artifact declares what a build needs. Exit 1 = it does not.
 */

import fs from 'node:fs'
import path from 'node:path'

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

if (process.exitCode) {
    console.error('Fix: update app.json (identifiers, version, assets) and eas.json build profiles, then rerun this check.')
} else {
    console.log('[PASS] Mobile deployable artifact readiness checks passed.')
}
