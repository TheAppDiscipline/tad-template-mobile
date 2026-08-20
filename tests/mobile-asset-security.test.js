import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { scanMobileAssets } from '../tools/check_mobile_assets.js'

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
  const result = scanMobileAssets(repoRoot)
  assert.equal(result.findings.length, 0, JSON.stringify(result.findings, null, 2))
  assert.ok(result.files.length >= 3)
})
