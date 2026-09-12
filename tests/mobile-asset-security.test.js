import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { checkMobileAssets, isForbiddenLegacyAssetSha256, scanMobileAssets } from '../tools/check_mobile_assets.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function runImageSize(payload) {
  const script = `const imageSize=require('image-size'); imageSize(Uint8Array.from(${JSON.stringify(payload)}))`
  return spawnSync(process.execPath, ['-e', script], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 1500,
  })
}

test('vendored image-size rejects the published infinite-loop payloads promptly', () => {
  const icns = [
    0x69, 0x63, 0x6e, 0x73, 0x00, 0x00, 0x00, 0x10,
    0x69, 0x73, 0x33, 0x32, 0x00, 0x00, 0x00, 0x00,
  ]
  const heif = [
    0x00, 0x00, 0x00, 0x10, 0x66, 0x74, 0x79, 0x70,
    0x61, 0x76, 0x69, 0x66, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x24, 0x6d, 0x65, 0x74, 0x61,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08,
    0x69, 0x70, 0x72, 0x70, 0x00, 0x00, 0x00, 0x14,
    0x69, 0x70, 0x63, 0x6f, 0x00, 0x00, 0x00, 0x00,
    0x69, 0x73, 0x70, 0x65, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]

  const icnsResult = runImageSize(icns)
  assert.notEqual(icnsResult.error?.code, 'ETIMEDOUT', 'ICNS parser blocked the Node.js event loop')
  assert.notEqual(icnsResult.status, 0, 'zero-length ICNS entry should be rejected')

  const heifResult = runImageSize(heif)
  assert.notEqual(heifResult.error?.code, 'ETIMEDOUT', 'HEIF parser blocked the Node.js event loop')
})

test('installed image-size is the documented fork and still parses a valid template PNG', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'node_modules', 'image-size', 'package.json'), 'utf8'))
  assert.equal(packageJson.version, '2.0.3-tad.1')
  assert.equal(packageJson.tadFork.upstreamCommit, 'a4178fbb334ddb22d94cb4228ed597c24fd02e10')

  const script = "const imageSize=require('image-size'); const size=imageSize('assets/icon.png'); if(!(size.width>0&&size.height>0)) process.exit(2)"
  const result = spawnSync(process.execPath, ['-e', script], { cwd: repoRoot, encoding: 'utf8', timeout: 1500 })
  assert.equal(result.error, undefined)
  assert.equal(result.status, 0, result.stderr)
})

test('asset preflight rejects dangerous magic bytes before Metro', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'tad-mobile-assets-'))
  try {
    fs.writeFileSync(path.join(fixture, 'malicious.png'), Buffer.from([
      0x69, 0x63, 0x6e, 0x73, 0x00, 0x00, 0x00, 0x10,
      0x69, 0x73, 0x33, 0x32, 0x00, 0x00, 0x00, 0x00,
    ]))
    const result = scanMobileAssets(fixture)
    assert.deepEqual(result.findings.map((finding) => finding.code), ['DANGEROUS_IMAGE_FORMAT'])

    const cli = spawnSync(process.execPath, [path.join(repoRoot, 'tools', 'check_mobile_assets.js'), fixture], {
      cwd: repoRoot,
      encoding: 'utf8',
    })
    assert.equal(cli.status, 1)
    assert.match(cli.stderr, /REJECTED before Metro/)
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true })
  }
})

test('all buyer template image assets pass the pre-Metro policy', () => {
  const result = checkMobileAssets(repoRoot)
  assert.equal(result.findings.length, 0, JSON.stringify(result.findings, null, 2))
  assert.ok(result.files.length >= 3)
})

test('the retired Mobile placeholder cannot return', () => {
  const retired = 'c7d0a1bfdedf9e0170cb953a64cbd5658663d98ca1408858fc2cf72f8a62c7dd'
  assert.equal(isForbiddenLegacyAssetSha256(retired), true)

  const current = ['icon.png', 'adaptive-icon.png', 'splash.png'].map((name) => (
    createHash('sha256').update(fs.readFileSync(path.join(repoRoot, 'assets', name))).digest('hex')
  ))
  assert.equal(new Set(current).size, 1, 'the three configured Mobile surfaces must remain byte-identical')
  assert.notEqual(current[0], retired)
})

function createSplashFixture() {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'tad-mobile-splash-'))
  const assets = path.join(fixture, 'assets')
  fs.mkdirSync(assets)
  fs.copyFileSync(path.join(repoRoot, 'assets', 'icon.png'), path.join(assets, 'icon.png'))
  fs.copyFileSync(path.join(repoRoot, 'assets', 'icon.png'), path.join(assets, 'splash.png'))
  fs.writeFileSync(path.join(fixture, 'app.json'), JSON.stringify({
    expo: {
      plugins: [[
        'expo-splash-screen',
        {
          image: './assets/splash.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
        },
      ]],
    },
  }, null, 2), 'utf8')
  return fixture
}

function mutateFixtureConfig(fixture, mutate) {
  const appJson = path.join(fixture, 'app.json')
  const config = JSON.parse(fs.readFileSync(appJson, 'utf8'))
  mutate(config)
  fs.writeFileSync(appJson, JSON.stringify(config, null, 2), 'utf8')
}

function runAssetPreflight(fixture) {
  return spawnSync(process.execPath, [path.join(repoRoot, 'tools', 'check_mobile_assets.js'), fixture], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
}

test('native splash contract negative controls fail closed in the production asset preflight', async (t) => {
  const cases = [
    {
      name: 'missing imageWidth',
      code: 'SPLASH_IMAGE_WIDTH_MISMATCH',
      mutate(fixture) {
        mutateFixtureConfig(fixture, (config) => { delete config.expo.plugins[0][1].imageWidth })
      },
    },
    {
      name: 'vertical splash asset returns',
      code: 'SPLASH_NOT_SQUARE',
      mutate(fixture) {
        const splash = path.join(fixture, 'assets', 'splash.png')
        const bytes = fs.readFileSync(splash)
        bytes.writeUInt32BE(2048, 20)
        fs.writeFileSync(splash, bytes)
      },
    },
    {
      name: 'plugin image path does not exist',
      code: 'SPLASH_IMAGE_MISSING',
      mutate(fixture) {
        mutateFixtureConfig(fixture, (config) => { config.expo.plugins[0][1].image = './assets/missing.png' })
      },
    },
    {
      name: 'resizeMode changes from contain',
      code: 'SPLASH_RESIZE_MODE_MISMATCH',
      mutate(fixture) {
        mutateFixtureConfig(fixture, (config) => { config.expo.plugins[0][1].resizeMode = 'cover' })
      },
    },
    {
      name: 'background changes from white',
      code: 'SPLASH_BACKGROUND_MISMATCH',
      mutate(fixture) {
        mutateFixtureConfig(fixture, (config) => { config.expo.plugins[0][1].backgroundColor = '#000000' })
      },
    },
    {
      name: 'legacy splash configuration returns',
      code: 'LEGACY_SPLASH_CONFIG_PRESENT',
      mutate(fixture) {
        mutateFixtureConfig(fixture, (config) => {
          config.expo.splash = {
            image: './assets/splash.png',
            resizeMode: 'contain',
            backgroundColor: '#ffffff',
          }
        })
      },
    },
  ]

  const validFixture = createSplashFixture()
  try {
    const valid = runAssetPreflight(validFixture)
    assert.equal(valid.status, 0, valid.stderr)
  } finally {
    fs.rmSync(validFixture, { recursive: true, force: true })
  }

  for (const scenario of cases) {
    await t.test(scenario.name, () => {
      const fixture = createSplashFixture()
      try {
        scenario.mutate(fixture)
        const result = runAssetPreflight(fixture)
        assert.equal(result.status, 1, `negative control unexpectedly passed: ${result.stdout}`)
        assert.match(result.stderr, new RegExp(scenario.code))
      } finally {
        fs.rmSync(fixture, { recursive: true, force: true })
      }
    })
  }
})
